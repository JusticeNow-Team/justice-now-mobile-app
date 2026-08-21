import { recordAuditEvent } from "../audit/auditService";
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

/**
 * Calculates the exact permission differences between an old role and a new role.
 */
export function getPermissionDiff(
  oldRole: SystemRole,
  newRole: SystemRole
): PermissionDiff {
  const oldPerms = new Set(getPermissionsForRole(oldRole));
  const newPerms = new Set(getPermissionsForRole(newRole));

  const gained: Permission[] = [];
  const removed: Permission[] = [];
  const unchanged: Permission[] = [];

  for (const p of newPerms) {
    if (oldPerms.has(p)) {
      unchanged.push(p);
    } else {
      gained.push(p);
    }
  }

  for (const p of oldPerms) {
    if (!newPerms.has(p)) {
      removed.push(p);
    }
  }

  return { gained, removed, unchanged };
}

// In-memory audit log for role changes
const inMemoryRoleAuditLogs: RoleAssignmentAuditLog[] = [];

/**
 * Updates a user's role in the database, validates permissions, and records an audit log.
 */
export async function updateUserRole(
  params: UpdateRoleParams
): Promise<UpdateRoleResult> {
  const {
    actorUserId,
    actorUserEmail = "admin@justicenow.org",
    actorRole,
    targetUserId,
    targetUserEmail,
    targetCurrentRole,
    newRole,
    reason,
  } = params;

  // 1. Validation (JN-240)
  const validation = validateRoleAssignment({
    actorRole,
    actorUserId,
    targetUserId,
    targetCurrentRole,
    proposedRole: newRole,
  });

  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const normalizedNewRole = normalizeRole(newRole)!;
  const now = new Date().toISOString();
  const diff = getPermissionDiff(targetCurrentRole, normalizedNewRole);

  // 2. Audit Event (JN-197 & AC 7)
  const auditLog: RoleAssignmentAuditLog = {
    id: `role_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    eventType: "STAFF_ROLE_CHANGED",
    actorId: actorUserId || "admin",
    actorEmail: actorUserEmail,
    targetUserId,
    targetUserEmail,
    previousRole: targetCurrentRole,
    newRole: normalizedNewRole,
    description: `Updated role for ${targetUserEmail} from "${targetCurrentRole}" to "${normalizedNewRole}". Gained ${diff.gained.length} perms, lost ${diff.removed.length} perms.`,
    reason: reason || "Administrative role assignment",
    timestamp: now,
  };

  inMemoryRoleAuditLogs.unshift(auditLog);

  // Unified Audit Integration (JN-256)
  try {
    void recordAuditEvent({
      eventType: "ROLE_CHANGED",
      actorId: actorUserId,
      actorEmail: actorUserEmail,
      actorRole: actorRole || "system_admin",
      targetId: targetUserId,
      targetEmail: targetUserEmail,
      action: "STAFF_ROLE_CHANGE",
      description: auditLog.description,
      details: {
        previousRole: targetCurrentRole,
        newRole: normalizedNewRole,
        reason,
        gainedPermissions: diff.gained,
        removedPermissions: diff.removed,
      },
    });
  } catch {
    // Non-fatal if offline
  }

  // 3. Database Sync
  try {
    await supabase
      .from("profiles")
      .update({
        role: normalizedNewRole,
        updated_at: now,
      })
      .eq("id", targetUserId);

    await supabase.from("staff_audit_logs").insert({
      id: auditLog.id,
      event_type: auditLog.eventType,
      actor_email: actorUserEmail,
      target_staff_id: targetUserId,
      target_staff_email: targetUserEmail,
      description: auditLog.description,
      details: {
        previousRole: targetCurrentRole,
        newRole: normalizedNewRole,
        reason,
        gainedPermissionsCount: diff.gained.length,
        removedPermissionsCount: diff.removed.length,
      },
      created_at: now,
    });
  } catch (err) {
    console.warn("Supabase update skipped in offline mode:", err);
  }

  return {
    success: true,
    newRole: normalizedNewRole,
    auditLog,
    permissionDiff: diff,
  };
}

/**
 * Returns role assignment audit logs.
 */
export function getRoleAssignmentAuditLogs(): RoleAssignmentAuditLog[] {
  return [...inMemoryRoleAuditLogs];
}
