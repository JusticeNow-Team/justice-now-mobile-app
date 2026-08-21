import { normalizeRole } from "./roles";
import { Permission, SystemRole } from "./types";

export type SystemModule =
  | "reporter_module"
  | "case_officer_module"
  | "evidence_checker_module"
  | "system_admin_module";

export interface ModuleActionDefinition {
  module: SystemModule;
  action: string;
  description: string;
  allowedRoles: SystemRole[];
  requiredPermissions: Permission[];
}

/**
 * Canonical Module Permission Matrix (JN-245)
 * Defines the strict boundaries for all 4 system modules.
 */
export const MODULE_PERMISSION_MATRIX: Record<string, ModuleActionDefinition> = {
  // --- 1. Reporter Module Operations ---
  "report:submit": {
    module: "reporter_module",
    action: "report:submit",
    description: "Submit new human-rights incident report",
    allowedRoles: ["reporter"],
    requiredPermissions: ["cases:create"],
  },
  "report:view_own": {
    module: "reporter_module",
    action: "report:view_own",
    description: "View own submitted cases",
    allowedRoles: ["reporter"],
    requiredPermissions: ["cases:read:own"],
  },
  "evidence:upload_own": {
    module: "reporter_module",
    action: "evidence:upload_own",
    description: "Upload evidence supporting own cases",
    allowedRoles: ["reporter"],
    requiredPermissions: ["evidence:upload:own"],
  },

  // --- 2. Case Officer Module Operations ---
  "case:investigate": {
    module: "case_officer_module",
    action: "case:investigate",
    description: "Review and investigate cases",
    allowedRoles: ["case_officer"],
    requiredPermissions: ["cases:read:all"],
  },
  "case:update_status": {
    module: "case_officer_module",
    action: "case:update_status",
    description: "Transition case status (e.g. Under Investigation, Closed)",
    allowedRoles: ["case_officer"],
    requiredPermissions: ["cases:update:status"],
  },
  "case:request_info": {
    module: "case_officer_module",
    action: "case:request_info",
    description: "Request additional information from reporter",
    allowedRoles: ["case_officer"],
    requiredPermissions: ["cases:request_info"],
  },
  "evidence:assign": {
    module: "case_officer_module",
    action: "evidence:assign",
    description: "Assign evidence record to Evidence Checker",
    allowedRoles: ["case_officer"],
    requiredPermissions: ["evidence:assign"],
  },

  // --- 3. Evidence Checker Module Operations ---
  "evidence:inspect_queue": {
    module: "evidence_checker_module",
    action: "evidence:inspect_queue",
    description: "Inspect evidence verification queue",
    allowedRoles: ["evidence_checker"],
    requiredPermissions: ["evidence:read:all"],
  },
  "evidence:validate": {
    module: "evidence_checker_module",
    action: "evidence:validate",
    description: "Record forensic validation decision on evidence",
    allowedRoles: ["evidence_checker"],
    requiredPermissions: ["evidence:validate"],
  },

  // --- 4. System Admin Module Operations ---
  "admin:staff_manage": {
    module: "system_admin_module",
    action: "admin:staff_manage",
    description: "Invite, create, activate, or deactivate staff accounts",
    allowedRoles: ["system_admin"],
    requiredPermissions: ["admin:users:manage"],
  },
  "admin:role_assign": {
    module: "system_admin_module",
    action: "admin:role_assign",
    description: "Assign or update user system roles",
    allowedRoles: ["system_admin"],
    requiredPermissions: ["admin:roles:manage"],
  },
  "admin:categories_configure": {
    module: "system_admin_module",
    action: "admin:categories_configure",
    description: "Create, seed, or toggle report categories",
    allowedRoles: ["system_admin"],
    requiredPermissions: ["admin:system:configure"],
  },
  "admin:audit_inspect": {
    module: "system_admin_module",
    action: "admin:audit_inspect",
    description: "Inspect system audit logs and tamper-evident history",
    allowedRoles: ["system_admin"],
    requiredPermissions: ["admin:audit_logs:read"],
  },
};

/**
 * Checks whether a given role is permitted to perform a module operation.
 */
export function isModuleActionPermitted(
  role: string | null | undefined,
  actionKey: string
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  const definition = MODULE_PERMISSION_MATRIX[actionKey];
  if (!definition) return false;

  return definition.allowedRoles.includes(normalized);
}

/**
 * Checks whether a role is permitted to access a given module workspace.
 */
export function isModuleAccessPermitted(
  role: string | null | undefined,
  module: SystemModule
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  switch (module) {
    case "reporter_module":
      return normalized === "reporter";
    case "case_officer_module":
      return normalized === "case_officer";
    case "evidence_checker_module":
      return normalized === "evidence_checker";
    case "system_admin_module":
      return normalized === "system_admin";
    default:
      return false;
  }
}
