import { hasAllPermissions, hasPermission } from "./permissions";
import { normalizeRole } from "./roles";
import { Permission, RouteAuthorizationRule, SystemRole } from "./types";

export class AuthorizationError extends Error {
  public code: string;
  public status: number;

  constructor(
    message: string = "Access denied: Unauthorized action or route.",
    code: string = "UNAUTHORIZED_ACCESS",
    status: number = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Route protection rules mapping path prefixes to allowed roles and permissions.
 */
export const ROUTE_AUTHORIZATION_RULES: RouteAuthorizationRule[] = [
  {
    pathPrefix: "/reporter",
    allowedRoles: ["reporter"],
    requiredPermissions: ["profile:read:own"],
  },
  {
    pathPrefix: "/officer",
    allowedRoles: ["case_officer"],
    requiredPermissions: ["cases:read:assigned"],
  },
  {
    pathPrefix: "/checker",
    allowedRoles: ["evidence_checker"],
    requiredPermissions: ["evidence:validate"],
  },
  {
    pathPrefix: "/admin",
    allowedRoles: ["system_admin"],
    requiredPermissions: ["admin:system:configure"],
  },
];

/**
 * Checks whether a role is authorized to access a given URL path.
 */
export function canAccessRoute(
  role: string | null | undefined,
  path: string
): boolean {
  // Public / auth routes are accessible to all
  if (
    path === "/" ||
    path.startsWith("/(auth)") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/language") ||
    path.startsWith("/secure-role") ||
    path.startsWith("/two-factor") ||
    path.startsWith("/otp")
  ) {
    return true;
  }

  const normalized = normalizeRole(role);
  if (!normalized) {
    return false;
  }

  const matchingRule = ROUTE_AUTHORIZATION_RULES.find((rule) =>
    path.startsWith(rule.pathPrefix)
  );

  if (!matchingRule) {
    // If route doesn't match any restricted prefix, allow by default
    return true;
  }

  const roleAllowed = matchingRule.allowedRoles.includes(normalized);
  if (!roleAllowed) {
    return false;
  }

  if (matchingRule.requiredPermissions && matchingRule.requiredPermissions.length > 0) {
    return hasAllPermissions(normalized, matchingRule.requiredPermissions);
  }

  return true;
}

/**
 * Asserts that the role matches one of the expected roles, throwing an AuthorizationError if not.
 */
export function assertRole(
  role: string | null | undefined,
  expectedRoles: SystemRole | SystemRole[]
): void {
  const normalized = normalizeRole(role);
  const allowed = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];

  if (!normalized || !allowed.includes(normalized)) {
    throw new AuthorizationError(
      `Role '${role || "anonymous"}' is not authorized to perform this action.`
    );
  }
}

/**
 * Asserts that the user has the required permission, throwing an AuthorizationError if not.
 */
export function assertPermission(
  role: string | null | undefined,
  requiredPermission: Permission
): void {
  if (!hasPermission(role, requiredPermission)) {
    throw new AuthorizationError(
      `Role '${role || "anonymous"}' lacks the required permission: '${requiredPermission}'.`
    );
  }
}
