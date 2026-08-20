import { ROLE_CONFIGS, normalizeRole } from "./roles";
import { Permission, SystemRole } from "./types";

export const PERMISSIONS = {
  // Case operations
  CASES_CREATE: "cases:create" as const,
  CASES_READ_OWN: "cases:read:own" as const,
  CASES_READ_ASSIGNED: "cases:read:assigned" as const,
  CASES_READ_ALL: "cases:read:all" as const,
  CASES_UPDATE_STATUS: "cases:update:status" as const,
  CASES_REQUEST_INFO: "cases:request_info" as const,
  CASES_DELETE: "cases:delete" as const,

  // Evidence operations
  EVIDENCE_UPLOAD_OWN: "evidence:upload:own" as const,
  EVIDENCE_READ_OWN: "evidence:read:own" as const,
  EVIDENCE_READ_ASSIGNED: "evidence:read:assigned" as const,
  EVIDENCE_READ_ALL: "evidence:read:all" as const,
  EVIDENCE_VALIDATE: "evidence:validate" as const,
  EVIDENCE_ASSIGN: "evidence:assign" as const,

  // Profile operations
  PROFILE_READ_OWN: "profile:read:own" as const,
  PROFILE_UPDATE_OWN: "profile:update:own" as const,
  PROFILE_SECURITY_MANAGE: "profile:security:manage" as const,

  // Admin operations
  ADMIN_USERS_READ: "admin:users:read" as const,
  ADMIN_USERS_MANAGE: "admin:users:manage" as const,
  ADMIN_ROLES_MANAGE: "admin:roles:manage" as const,
  ADMIN_AUDIT_LOGS_READ: "admin:audit_logs:read" as const,
  ADMIN_SYSTEM_CONFIGURE: "admin:system:configure" as const,
};

/**
 * Maps each SystemRole to its exact permission array.
 */
export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  reporter: ROLE_CONFIGS.reporter.permissions,
  case_officer: ROLE_CONFIGS.case_officer.permissions,
  evidence_checker: ROLE_CONFIGS.evidence_checker.permissions,
  system_admin: ROLE_CONFIGS.system_admin.permissions,
};

/**
 * Returns all permissions granted to a given role.
 */
export function getPermissionsForRole(
  role: string | null | undefined
): Permission[] {
  const normalized = normalizeRole(role);
  if (!normalized) return [];
  return ROLE_PERMISSIONS[normalized] || [];
}

/**
 * Checks whether a given role has a specific permission.
 */
export function hasPermission(
  role: string | null | undefined,
  permission: Permission
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Checks whether a given role has at least one of the listed permissions.
 */
export function hasAnyPermission(
  role: string | null | undefined,
  permissions: Permission[]
): boolean {
  if (permissions.length === 0) return true;
  const rolePermissions = getPermissionsForRole(role);
  return permissions.some((p) => rolePermissions.includes(p));
}

/**
 * Checks whether a given role has all of the listed permissions.
 */
export function hasAllPermissions(
  role: string | null | undefined,
  permissions: Permission[]
): boolean {
  if (permissions.length === 0) return true;
  const rolePermissions = getPermissionsForRole(role);
  return permissions.every((p) => rolePermissions.includes(p));
}
