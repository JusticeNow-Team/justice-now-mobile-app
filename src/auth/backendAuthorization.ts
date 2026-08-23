import { AuthorizationError } from "./middleware";
import { isModuleActionPermitted } from "./permissionMatrix";
import { normalizeRole } from "./roles";
import { SystemRole } from "./types";

export interface AuthorizationResult {
  authorized: boolean;
  role: SystemRole | null;
  error?: string;
  statusCode: number;
}

/**
 * Validates backend API / service authorization independently of the UI (JN-246 & AC 6).
 */
export function authorizeBackendAction(
  userRole: string | null | undefined,
  actionKey: string,
  resourceOwnerId?: string,
  currentUserId?: string
): AuthorizationResult {
  const normalized = normalizeRole(userRole);

  if (!normalized) {
    return {
      authorized: false,
      role: null,
      error: "Authentication required: No valid session role provided.",
      statusCode: 401,
    };
  }

  // Owner access check for reporter personal records
  if (actionKey === "report:view_own" || actionKey === "evidence:upload_own") {
    if (resourceOwnerId && currentUserId && resourceOwnerId !== currentUserId) {
      return {
        authorized: false,
        role: normalized,
        error: "Forbidden: You cannot access or modify cases submitted by another reporter.",
        statusCode: 403,
      };
    }
  }

  const isPermitted = isModuleActionPermitted(normalized, actionKey);

  if (!isPermitted) {
    return {
      authorized: false,
      role: normalized,
      error: `Forbidden: Role '${normalized}' is not authorized to execute '${actionKey}'.`,
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    role: normalized,
    statusCode: 200,
  };
}

/**
 * Asserts backend action authorization, throwing an AuthorizationError if rejected.
 */
export function assertBackendAction(
  userRole: string | null | undefined,
  actionKey: string,
  resourceOwnerId?: string,
  currentUserId?: string
): void {
  const result = authorizeBackendAction(
    userRole,
    actionKey,
    resourceOwnerId,
    currentUserId
  );

  if (!result.authorized) {
    throw new AuthorizationError(
      result.error || "Access denied by backend authorization policy.",
      "FORBIDDEN_MODULE_ACTION",
      result.statusCode
    );
  }
}

/**
 * Explicit guard: Ensures Evidence Checkers cannot modify case management fields (AC 3).
 */
export function assertCaseManagementUpdateAllowed(
  userRole: string | null | undefined
): void {
  const normalized = normalizeRole(userRole);
  if (normalized === "evidence_checker") {
    throw new AuthorizationError(
      "Module Policy Violation: Evidence Checkers are prohibited from updating case-management fields.",
      "CHECKER_CASE_UPDATE_PROHIBITED",
      403
    );
  }
  assertBackendAction(userRole, "case:update_status");
}

/**
 * Explicit guard: Ensures Case Officers cannot access System Admin operations (AC 2).
 */
export function assertAdminOperationAllowed(
  userRole: string | null | undefined,
  action: "admin:staff_manage" | "admin:role_assign" | "admin:categories_configure" | "admin:audit_inspect" = "admin:staff_manage"
): void {
  const normalized = normalizeRole(userRole);
  if (normalized === "case_officer" || normalized === "evidence_checker" || normalized === "reporter") {
    throw new AuthorizationError(
      `Module Policy Violation: Role '${normalized}' is prohibited from executing System Administration operations.`,
      "ADMIN_OPERATION_PROHIBITED",
      403
    );
  }
  assertBackendAction(userRole, action);
}
