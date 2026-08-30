import { supabase } from "../lib/supabase";
import { getPermissionsForRole } from "./permissions";
import { normalizeRole } from "./roles";
import { validateRoleAssignment } from "./roleValidation";
import { Permission, SystemRole } from "./types";

export interface PermissionDiff {
  gained: Permission[];
  removed: Permission[];
  unchanged: Permission[];
}

export interface RoleAssignmentAuditLog {
  id: string;
  eventType: "STAFF_ROLE_CHANGED";
  actorId: string;
  actorEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  previousRole: SystemRole;
  newRole: SystemRole;
  description: string;
  reason?: string;
  timestamp: string;
}

export interface UpdateRoleParams {
  actorUserId?: string;
  actorUserEmail?: string;
  actorRole: SystemRole | null;
  targetUserId: string;
  targetUserEmail: string;
  targetCurrentRole: SystemRole;
  newRole: string;
  reason?: string;
}

export interface UpdateRoleResult {
  success: boolean;
  newRole?: SystemRole;
  auditLog?: RoleAssignmentAuditLog;
  permissionDiff?: PermissionDiff;
  error?: string;
}

const roleAuditLogs: RoleAssignmentAuditLog[] = [];

export function getPermissionDiff(
  oldRole: SystemRole,
  newRole: SystemRole,
): PermissionDiff {
  const oldPermissions = new Set(getPermissionsForRole(oldRole));
  const newPermissions = new Set(getPermissionsForRole(newRole));

  return {
    gained: [...newPermissions].filter(
      (permission) => !oldPermissions.has(permission),
    ),
    removed: [...oldPermissions].filter(
      (permission) => !newPermissions.has(permission),
    ),
    unchanged: [...newPermissions].filter((permission) =>
      oldPermissions.has(permission),
    ),
  };
}

async function functionErrorMessage(error: any, data: any) {
  if (data?.error) {
    return String(data.error);
  }

  try {
    if (error?.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) {
        return String(body.error);
      }
    }
  } catch {
    // Fall through to the SDK error message.
  }

  return error?.message || "Unable to change the account role.";
}

export async function updateUserRole(
  params: UpdateRoleParams,
): Promise<UpdateRoleResult> {
  const validation = validateRoleAssignment({
    actorRole: params.actorRole,
    actorUserId: params.actorUserId,
    targetUserId: params.targetUserId,
    targetCurrentRole: params.targetCurrentRole,
    proposedRole: params.newRole,
  });

  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const normalizedNewRole = normalizeRole(params.newRole);
  if (!normalizedNewRole) {
    return { success: false, error: "Select a valid JusticeNow role." };
  }

  const permissionDiff = getPermissionDiff(
    params.targetCurrentRole,
    normalizedNewRole,
  );

  try {
    const { data, error } = await supabase.functions.invoke("admin-staff", {
      body: {
        action: "set_role",
        staffId: params.targetUserId,
        role: normalizedNewRole,
        reason: params.reason?.trim() || "Administrative role assignment",
      },
    });

    if (error || !data?.staff) {
      return {
        success: false,
        error: await functionErrorMessage(error, data),
      };
    }

    const timestamp = new Date().toISOString();
    const auditLog: RoleAssignmentAuditLog = {
      id: `role-${timestamp}-${params.targetUserId}`,
      eventType: "STAFF_ROLE_CHANGED",
      actorId: params.actorUserId || "system_admin",
      actorEmail: params.actorUserEmail || "admin@justicenow.org",
      targetUserId: params.targetUserId,
      targetUserEmail: params.targetUserEmail,
      previousRole: params.targetCurrentRole,
      newRole: normalizedNewRole,
      description: `Changed ${params.targetUserEmail} from ${params.targetCurrentRole} to ${normalizedNewRole}.`,
      reason: params.reason?.trim() || "Administrative role assignment",
      timestamp,
    };

    roleAuditLogs.unshift(auditLog);

    return {
      success: true,
      newRole: normalizedNewRole,
      auditLog,
      permissionDiff,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to change the account role.",
    };
  }
}

export function getRoleAssignmentAuditLogs(): RoleAssignmentAuditLog[] {
  return [...roleAuditLogs];
}
