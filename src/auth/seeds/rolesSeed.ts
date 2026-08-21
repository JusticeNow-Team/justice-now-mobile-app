import { ROLE_CONFIGS } from "../roles";
import { SystemRole } from "../types";

export interface SeedRoleRecord {
  id: SystemRole;
  name: string;
  label: string;
  description: string;
  is_staff: boolean;
  default_route: string;
  created_at: string;
}

export interface SeedRolePermissionRecord {
  role_id: SystemRole;
  permission: string;
}

/**
 * Seed data for four system roles:
 * 1. Reporter
 * 2. Case Officer
 * 3. Evidence Checker
 * 4. System Admin
 */
export const SEED_ROLES: SeedRoleRecord[] = (
  Object.keys(ROLE_CONFIGS) as SystemRole[]
).map((roleKey) => {
  const config = ROLE_CONFIGS[roleKey];
  return {
    id: config.id,
    name: config.name,
    label: config.label,
    description: config.description,
    is_staff: config.isStaff,
    default_route: config.defaultRoute,
    created_at: "2026-01-01T00:00:00.000Z",
  };
});

/**
 * Seed data mapping all permissions to their respective roles.
 */
export const SEED_ROLE_PERMISSIONS: SeedRolePermissionRecord[] = (
  Object.keys(ROLE_CONFIGS) as SystemRole[]
).flatMap((roleKey) => {
  const config = ROLE_CONFIGS[roleKey];
  return config.permissions.map((perm) => ({
    role_id: config.id,
    permission: perm,
  }));
});
