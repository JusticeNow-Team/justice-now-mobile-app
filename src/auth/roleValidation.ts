import { normalizeRole } from "./roles";
import { SystemRole } from "./types";

export interface RoleValidationResult {
  isValid: boolean;
  error?: string;
}

const VALID_SYSTEM_ROLES: SystemRole[] = [
  "reporter",
  "case_officer",
  "evidence_checker",
  "system_admin",
];

/**
 * Validates whether a given role string is a supported SystemRole.
 */
export function isValidSystemRole(role: string): role is SystemRole {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return Boolean(normalized && VALID_SYSTEM_ROLES.includes(normalized));
}

/**
 * Validates a proposed role change operation.
 * Enforces:
 * 1. Actor must be a System Administrator (AC 6).
 * 2. Target role must be a supported valid system role (AC 4).
 * 3. Role cannot be changed to identical role (no-op).
 * 4. Active admin cannot self-demote (AC 6 - lockout prevention).
 */
export function validateRoleAssignment(params: {
  actorRole: SystemRole | null;
  actorUserId?: string;
  targetUserId: string;
  targetCurrentRole: SystemRole;
  proposedRole: string;
}): RoleValidationResult {
  const {
    actorRole,
    actorUserId,
    targetUserId,
    targetCurrentRole,
    proposedRole,
  } = params;

  // 1. Authorization Check (AC 6)
  if (actorRole !== "system_admin") {
    return {
      isValid: false,
      error: "Unauthorized: Only System Administrators can assign or update user roles.",
    };
  }

  // 2. Role Validity Check (AC 4)
  if (!isValidSystemRole(proposedRole)) {
    return {
      isValid: false,
      error: `Invalid role: "${proposedRole}" is not a recognized system role. Supported roles: ${VALID_SYSTEM_ROLES.join(", ")}.`,
    };
  }

  const normalizedTargetRole = normalizeRole(proposedRole)!;

  // 3. No-Op Check
  if (targetCurrentRole === normalizedTargetRole) {
    return {
      isValid: false,
      error: `User is already assigned to the "${normalizedTargetRole}" role.`,
    };
  }

  // 4. Admin Self-Demotion Lockout Guard (AC 6)
  if (
    actorUserId &&
    actorUserId === targetUserId &&
    targetCurrentRole === "system_admin" &&
    normalizedTargetRole !== "system_admin"
  ) {
    return {
      isValid: false,
      error: "Security Protection: You cannot demote your own administrator account while logged in.",
    };
  }

  return { isValid: true };
}
