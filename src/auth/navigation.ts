import { normalizeRole } from "./roles";
import { DashboardRoute, PostLoginRedirectResult, SystemRole, UserProfile } from "./types";

/**
 * Canonical mapping between system roles and their designated dashboard workspaces.
 */
export const ROLE_DASHBOARD_ROUTES: Record<SystemRole, DashboardRoute> = {
  reporter: "/reporter",
  case_officer: "/officer",
  evidence_checker: "/checker",
  system_admin: "/admin",
};

/**
 * Public routes that do not require role authorization.
 */
export const PUBLIC_AUTH_ROUTES = [
  "/",
  "/login",
  "/register",
  "/secure-role",
  "/two-factor",
  "/forgot-password",
  "/onboarding",
  "/unauthorized",
] as const;

/**
 * Resolves the designated dashboard route for a given system role.
 *
 * @param role The role string or identifier
 * @returns The canonical dashboard path (e.g. "/admin") or null if unrecognized
 */
export function getDashboardRouteForRole(
  role: string | null | undefined
): DashboardRoute | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  return ROLE_DASHBOARD_ROUTES[normalized] || null;
}

/**
 * Determines which role a dashboard route belongs to.
 *
 * @param pathname The URL path
 * @returns The required SystemRole, or null if not a role dashboard route
 */
export function getRoleForDashboardRoute(pathname: string): SystemRole | null {
  if (!pathname) return null;
  const cleanPath = pathname.trim().toLowerCase();

  if (cleanPath === "/reporter" || cleanPath.startsWith("/reporter/")) {
    return "reporter";
  }
  if (cleanPath === "/officer" || cleanPath.startsWith("/officer/")) {
    return "case_officer";
  }
  if (cleanPath === "/checker" || cleanPath.startsWith("/checker/")) {
    return "evidence_checker";
  }
  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) {
    return "system_admin";
  }

  return null;
}

/**
 * Checks whether an account profile is currently active and permitted to use the system.
 */
export function isAccountActive(
  profile: Partial<UserProfile> | null | undefined
): boolean {
  if (!profile) return true; // Default to active if profile status isn't specified
  if (profile.is_active === false) return false;
  if (profile.status === "inactive" || profile.status === "suspended") return false;
  return true;
}

/**
 * Checks if a given role is authorized to access a given URL path.
 *
 * @param role The user's active role
 * @param pathname The requested target URL path
 * @returns boolean indicating whether access is permitted
 */
export function isRoleAuthorizedForPath(
  role: string | null | undefined,
  pathname: string
): boolean {
  if (!pathname) return false;
  const cleanPath = pathname.trim().toLowerCase();

  // Public routes are always accessible
  for (const pub of PUBLIC_AUTH_ROUTES) {
    if (cleanPath === pub || cleanPath.startsWith(`${pub}/`)) {
      return true;
    }
  }

  const normalized = normalizeRole(role);
  if (!normalized) return false;

  const requiredRole = getRoleForDashboardRoute(cleanPath);
  if (!requiredRole) {
    // If not a dashboard route, allow authenticated user by default
    return true;
  }

  return normalized === requiredRole;
}

/**
 * Resolves post-login redirection for a user profile or role.
 *
 * Handles:
 * - Direct routing to assigned dashboard (Reporter -> /reporter, Case Officer -> /officer, etc.)
 * - Rejection of unknown / null roles
 * - Rejection of inactive / suspended accounts
 */
export function resolvePostLoginRedirect(
  profileOrRole: string | Partial<UserProfile> | null | undefined
): PostLoginRedirectResult {
  if (!profileOrRole) {
    return {
      allowed: false,
      targetRoute: "/login",
      role: null,
      error: "No role provided for user account.",
      reason: "invalid_role",
    };
  }

  let roleStr: string | undefined;
  let active = true;

  if (typeof profileOrRole === "string") {
    roleStr = profileOrRole;
  } else {
    roleStr = profileOrRole.role;
    active = isAccountActive(profileOrRole as UserProfile);
  }

  const normalized = normalizeRole(roleStr);

  if (!normalized) {
    return {
      allowed: false,
      targetRoute: "/login",
      role: null,
      error: "Unknown or invalid user role assigned to this account.",
      reason: "invalid_role",
    };
  }

  if (!active) {
    return {
      allowed: false,
      targetRoute: "/unauthorized?reason=inactive",
      role: normalized,
      error: "Your account or assigned role is currently inactive. Please contact your system administrator.",
      reason: "inactive_account",
    };
  }

  const targetRoute = ROLE_DASHBOARD_ROUTES[normalized];

  return {
    allowed: true,
    targetRoute,
    role: normalized,
  };
}
