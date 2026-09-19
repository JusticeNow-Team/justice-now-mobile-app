import { recordAuditEvent } from "../audit/auditService";
import { normalizeRole } from "../auth/roles";
import { supabase } from "../lib/supabase";
import {
  CreateStatusConfigInput,
  StatusEntityType,
  StatusFilterOptions,
  UpdateStatusConfigInput,
  WorkflowStatusConfig,
} from "./types";
import { canDeleteStatus, slugifyStatusCode, validateStatusInput } from "./validation";

// Seed default Case & Evidence statuses
export const INITIAL_CASE_STATUSES: WorkflowStatusConfig[] = [
  {
    id: "stat_case_submitted",
    entityType: "case",
    code: "submitted",
    name: "Submitted",
    description: "Case report has been safely received and queued for intake triage.",
    tone: "info",
    icon: "document",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 1,
    activeRecordCount: 12,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_under_review",
    entityType: "case",
    code: "under_review",
    name: "Under Review",
    description: "Assigned Case Officer is reviewing incident report details and jurisdictional fit.",
    tone: "warning",
    icon: "file-search",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 2,
    activeRecordCount: 18,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_investigating",
    entityType: "case",
    code: "investigating",
    name: "Under Investigation",
    description: "Active investigation underway with field interviews and forensic evidence compilation.",
    tone: "info",
    icon: "activity",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 3,
    activeRecordCount: 24,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_awaiting_info",
    entityType: "case",
    code: "awaiting_information",
    name: "Awaiting Information",
    description: "Case Officer has requested supplementary evidence or clarification from the reporter.",
    tone: "warning",
    icon: "alert-circle",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 4,
    activeRecordCount: 7,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_action_taken",
    entityType: "case",
    code: "action_taken",
    name: "Action Taken",
    description: "Legal, protective, or institutional advocacy actions have been executed.",
    tone: "success",
    icon: "shield-check",
    isActive: true,
    isSystemDefault: false,
    displayOrder: 5,
    activeRecordCount: 15,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_resolved",
    entityType: "case",
    code: "resolved",
    name: "Resolved",
    description: "Case investigation concluded and formal remedy or legal outcome reached.",
    tone: "success",
    icon: "check-circle",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 6,
    activeRecordCount: 85,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_dismissed",
    entityType: "case",
    code: "dismissed",
    name: "Dismissed",
    description: "Case closed without action due to insufficient evidence, duplication, or lack of mandate.",
    tone: "neutral",
    icon: "circle-x",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 7,
    activeRecordCount: 9,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_case_withdrawn",
    entityType: "case",
    code: "withdrawn",
    name: "Withdrawn",
    description: "Case voluntarily withdrawn by the reporter following approved withdrawal review.",
    tone: "neutral",
    icon: "log-out",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 8,
    activeRecordCount: 4,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

export const INITIAL_EVIDENCE_STATUSES: WorkflowStatusConfig[] = [
  {
    id: "stat_ev_pending",
    entityType: "evidence",
    code: "pending",
    name: "Pending Review",
    description: "Evidence uploaded by reporter awaiting assignment to an Evidence Checker.",
    tone: "warning",
    icon: "clock",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 1,
    activeRecordCount: 14,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_ev_under_review",
    entityType: "evidence",
    code: "under_review",
    name: "Under Review",
    description: "Assigned Evidence Checker is actively inspecting metadata, integrity, and authenticity.",
    tone: "info",
    icon: "file-search",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 2,
    activeRecordCount: 8,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_ev_approved",
    entityType: "evidence",
    code: "approved",
    name: "Approved",
    description: "Forensic authenticity and chain of custody verified and accepted as legal evidence.",
    tone: "success",
    icon: "check-circle",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 3,
    activeRecordCount: 112,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_ev_rejected",
    entityType: "evidence",
    code: "rejected",
    name: "Rejected",
    description: "Evidence failed validation checks due to tampering, corruption, or illegibility.",
    tone: "danger",
    icon: "circle-x",
    isActive: true,
    isSystemDefault: true,
    displayOrder: 4,
    activeRecordCount: 6,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_ev_reassign",
    entityType: "evidence",
    code: "reassignment_requested",
    name: "Reassignment Requested",
    description: "Evidence file requires a different forensic specialist or secondary appraisal.",
    tone: "warning",
    icon: "refresh-cw",
    isActive: true,
    isSystemDefault: false,
    displayOrder: 5,
    activeRecordCount: 3,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "stat_ev_escalated",
    entityType: "evidence",
    code: "escalated",
    name: "Escalated for Secondary Review",
    description: "High-sensitivity or contested evidence escalated to Chief Forensic Examiner.",
    tone: "danger",
    icon: "shield-alert",
    isActive: true,
    isSystemDefault: false,
    displayOrder: 6,
    activeRecordCount: 2,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

// In-memory store for reactive development and unit test suite execution
let inMemoryStatusStore: WorkflowStatusConfig[] = [
  ...INITIAL_CASE_STATUSES.map((s) => ({ ...s })),
  ...INITIAL_EVIDENCE_STATUSES.map((s) => ({ ...s })),
];

/**
 * JN-273 & AC 1 & AC 2: Retrieve workflow statuses for cases or evidence.
 */
export async function getStatusConfigs(
  entityType?: StatusEntityType,
  options: StatusFilterOptions = {},
): Promise<WorkflowStatusConfig[]> {
  try {
    let query = supabase
      .from("workflow_status_configs")
      .select("*")
      .order("display_order", { ascending: true });

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return filterInMemoryStatuses(entityType, options);
    }

    const mapped: WorkflowStatusConfig[] = data.map((row: any) => ({
      id: row.id,
      entityType: row.entity_type,
      code: row.code,
      name: row.name,
      description: row.description || "",
      tone: row.tone || "neutral",
      icon: row.icon || undefined,
      isActive: row.is_active !== false,
      isSystemDefault: Boolean(row.is_system_default),
      displayOrder: row.display_order || 0,
      activeRecordCount: row.active_record_count || 0,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));

    return applyFilters(mapped, options);
  } catch {
    return filterInMemoryStatuses(entityType, options);
  }
}

function filterInMemoryStatuses(
  entityType?: StatusEntityType,
  options: StatusFilterOptions = {},
): WorkflowStatusConfig[] {
  let list = [...inMemoryStatusStore];
  if (entityType) {
    list = list.filter((s) => s.entityType === entityType);
  }
  return applyFilters(list, options);
}

function applyFilters(
  list: WorkflowStatusConfig[],
  options: StatusFilterOptions,
): WorkflowStatusConfig[] {
  let result = list;

  if (options.activeOnly || options.statusFilter === "active") {
    result = result.filter((s) => s.isActive);
  } else if (options.statusFilter === "inactive") {
    result = result.filter((s) => !s.isActive);
  }

  if (options.searchQuery?.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter((s) =>
      [s.name, s.code, s.description].join(" ").toLowerCase().includes(q),
    );
  }

  return result.sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * AC 5: Inactive statuses are hidden from new operations while preserving history.
 * Returns only active, valid statuses for case transitions or evidence decisions.
 */
export async function getAvailableStatusesForOperations(
  entityType: StatusEntityType,
): Promise<WorkflowStatusConfig[]> {
  const all = await getStatusConfigs(entityType, { activeOnly: true });
  return all.filter((s) => s.isActive);
}

export async function getStatusConfigById(
  id: string,
): Promise<WorkflowStatusConfig | null> {
  const all = await getStatusConfigs();
  return all.find((s) => s.id === id) || null;
}

/**
 * JN-274 & JN-275 & AC 3 & AC 6 & AC 7: Admin creates a new workflow status.
 */
export async function createStatusConfig(
  input: CreateStatusConfigInput,
  actor?: { role?: string; userId?: string; email?: string },
): Promise<{
  success: boolean;
  status?: WorkflowStatusConfig;
  error?: string;
  errors?: string[];
}> {
  const actorRoleNorm = normalizeRole(actor?.role);

  // AC 6: Role Guard
  if (actorRoleNorm !== "system_admin") {
    return {
      success: false,
      error: "Unauthorized: Only System Administrators can configure workflow status values.",
    };
  }

  const existing = await getStatusConfigs(input.entityType);
  const validation = validateStatusInput(input, existing);

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors[0],
      errors: validation.errors,
    };
  }

  const code = (input.code?.trim() || slugifyStatusCode(input.name)).toLowerCase();
  const now = new Date().toISOString();

  const newStatus: WorkflowStatusConfig = {
    id: `stat_${input.entityType}_${Date.now()}`,
    entityType: input.entityType,
    code,
    name: input.name.trim(),
    description: input.description.trim(),
    tone: input.tone || "neutral",
    icon: input.icon || "document",
    isActive: input.isActive !== undefined ? input.isActive : true,
    isSystemDefault: false,
    displayOrder:
      input.displayOrder ||
      (existing.length > 0
        ? Math.max(...existing.map((s) => s.displayOrder)) + 1
        : 1),
    activeRecordCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  inMemoryStatusStore.push(newStatus);

  // Sync to database if connected
  try {
    await supabase.from("workflow_status_configs").insert({
      id: newStatus.id,
      entity_type: newStatus.entityType,
      code: newStatus.code,
      name: newStatus.name,
      description: newStatus.description,
      tone: newStatus.tone,
      icon: newStatus.icon,
      is_active: newStatus.isActive,
      is_system_default: newStatus.isSystemDefault,
      display_order: newStatus.displayOrder,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    console.warn("Database sync warning for status creation:", err);
  }

  // JN-278 & AC 7: Record audit event
  try {
    await recordAuditEvent({
      eventType: "STATUS_CONFIG_CREATED" as any,
      actorId: actor?.userId || "admin-system",
      actorEmail: actor?.email || "admin@justicenow.org",
      actorRole: "system_admin",
      targetId: newStatus.id,
      targetEmail: "system@justicenow.org",
      action: "STATUS_CONFIG_CREATED",
      description: `Created new ${newStatus.entityType} status "${newStatus.name}" [code: ${newStatus.code}].`,
      details: {
        statusId: newStatus.id,
        entityType: newStatus.entityType,
        code: newStatus.code,
        name: newStatus.name,
        tone: newStatus.tone,
      },
    });
  } catch (auditErr) {
    console.warn("Audit logging warning:", auditErr);
  }

  return {
    success: true,
    status: newStatus,
  };
}

/**
 * JN-274 & JN-275 & AC 3 & AC 6 & AC 7: Admin updates an existing status.
 */
export async function updateStatusConfig(
  id: string,
  input: UpdateStatusConfigInput,
  actor?: { role?: string; userId?: string; email?: string },
  reason?: string,
): Promise<{
  success: boolean;
  status?: WorkflowStatusConfig;
  error?: string;
  errors?: string[];
}> {
  const actorRoleNorm = normalizeRole(actor?.role);

  // AC 6: Role Guard
  if (actorRoleNorm !== "system_admin") {
    return {
      success: false,
      error: "Unauthorized: Only System Administrators can configure workflow status values.",
    };
  }

  const idx = inMemoryStatusStore.findIndex((s) => s.id === id);
  if (idx === -1) {
    return { success: false, error: "Status configuration not found." };
  }

  const prev = inMemoryStatusStore[idx];
  const existing = await getStatusConfigs(prev.entityType);
  const validation = validateStatusInput(
    { ...input, code: prev.code, entityType: prev.entityType },
    existing,
    id,
  );

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors[0],
      errors: validation.errors,
    };
  }

  const now = new Date().toISOString();
  const updated: WorkflowStatusConfig = {
    ...prev,
    name: input.name ? input.name.trim() : prev.name,
    description: input.description !== undefined ? input.description.trim() : prev.description,
    tone: input.tone || prev.tone,
    icon: input.icon || prev.icon,
    isActive: input.isActive !== undefined ? input.isActive : prev.isActive,
    displayOrder: input.displayOrder !== undefined ? input.displayOrder : prev.displayOrder,
    updatedAt: now,
  };

  inMemoryStatusStore[idx] = updated;

  // Sync to database if connected
  try {
    await supabase
      .from("workflow_status_configs")
      .update({
        name: updated.name,
        description: updated.description,
        tone: updated.tone,
        icon: updated.icon,
        is_active: updated.isActive,
        display_order: updated.displayOrder,
        updated_at: now,
      })
      .eq("id", id);
  } catch (err) {
    console.warn("Database sync warning for status update:", err);
  }

  // JN-278 & AC 7: Record audit event
  try {
    await recordAuditEvent({
      eventType: "STATUS_CONFIG_UPDATED" as any,
      actorId: actor?.userId || "admin-system",
      actorEmail: actor?.email || "admin@justicenow.org",
      actorRole: "system_admin",
      targetId: id,
      targetEmail: "system@justicenow.org",
      action: "STATUS_CONFIG_UPDATED",
      description: `Updated ${updated.entityType} status "${updated.name}" [code: ${updated.code}]. Reason: ${reason || "Administrative update"}`,
      details: {
        statusId: id,
        entityType: updated.entityType,
        previousState: prev,
        newState: updated,
        reason: reason || "Administrative update",
      },
    });
  } catch (auditErr) {
    console.warn("Audit logging warning:", auditErr);
  }

  return {
    success: true,
    status: updated,
  };
}

/**
 * JN-276 & AC 5: Admin activates or deactivates a status.
 */
export async function toggleStatusActive(
  id: string,
  isActive: boolean,
  actor?: { role?: string; userId?: string; email?: string },
  reason?: string,
): Promise<{
  success: boolean;
  status?: WorkflowStatusConfig;
  error?: string;
}> {
  const actorRoleNorm = normalizeRole(actor?.role);

  if (actorRoleNorm !== "system_admin") {
    return {
      success: false,
      error: "Unauthorized: Only System Administrators can change status availability.",
    };
  }

  const idx = inMemoryStatusStore.findIndex((s) => s.id === id);
  if (idx === -1) {
    return { success: false, error: "Status configuration not found." };
  }

  const prev = inMemoryStatusStore[idx];
  const now = new Date().toISOString();

  const updated: WorkflowStatusConfig = {
    ...prev,
    isActive,
    updatedAt: now,
  };

  inMemoryStatusStore[idx] = updated;

  // Sync to database
  try {
    await supabase
      .from("workflow_status_configs")
      .update({ is_active: isActive, updated_at: now })
      .eq("id", id);
  } catch (err) {
    console.warn("Database sync warning:", err);
  }

  // JN-278 & AC 7: Record audit event
  const actionType = isActive
    ? "STATUS_CONFIG_ACTIVATED"
    : "STATUS_CONFIG_DEACTIVATED";

  try {
    await recordAuditEvent({
      eventType: actionType as any,
      actorId: actor?.userId || "admin-system",
      actorEmail: actor?.email || "admin@justicenow.org",
      actorRole: "system_admin",
      targetId: id,
      targetEmail: "system@justicenow.org",
      action: actionType,
      description: `${isActive ? "Activated" : "Deactivated"} ${prev.entityType} status "${prev.name}". Reason: ${reason || "Administrative toggle"}`,
      details: {
        statusId: id,
        entityType: prev.entityType,
        code: prev.code,
        previousActive: prev.isActive,
        newActive: isActive,
        reason: reason || "Administrative toggle",
      },
    });
  } catch (auditErr) {
    console.warn("Audit logging warning:", auditErr);
  }

  return {
    success: true,
    status: updated,
  };
}

/**
 * JN-277 & AC 4: Safely delete a status configuration.
 * BLOCKS deletion if the status is a system default OR actively referenced by records.
 */
export async function deleteStatusConfig(
  id: string,
  actor?: { role?: string; userId?: string; email?: string },
  reason?: string,
): Promise<{
  success: boolean;
  error?: string;
  activeRecordCount?: number;
}> {
  const actorRoleNorm = normalizeRole(actor?.role);

  if (actorRoleNorm !== "system_admin") {
    return {
      success: false,
      error: "Unauthorized: Only System Administrators can delete status values.",
    };
  }

  const target = inMemoryStatusStore.find((s) => s.id === id);
  if (!target) {
    return { success: false, error: "Status configuration not found." };
  }

  // Enforce AC 4: Record protection check
  const deleteCheck = canDeleteStatus(target);
  if (!deleteCheck.allowed) {
    return {
      success: false,
      error: deleteCheck.reason,
      activeRecordCount: deleteCheck.activeRecordCount,
    };
  }

  // Remove from store
  inMemoryStatusStore = inMemoryStatusStore.filter((s) => s.id !== id);

  // Sync to database
  try {
    await supabase.from("workflow_status_configs").delete().eq("id", id);
  } catch (err) {
    console.warn("Database sync warning for status deletion:", err);
  }

  // JN-278 & AC 7: Record audit event
  try {
    await recordAuditEvent({
      eventType: "STATUS_CONFIG_DELETED" as any,
      actorId: actor?.userId || "admin-system",
      actorEmail: actor?.email || "admin@justicenow.org",
      actorRole: "system_admin",
      targetId: id,
      targetEmail: "system@justicenow.org",
      action: "STATUS_CONFIG_DELETED",
      description: `Deleted custom ${target.entityType} status "${target.name}" [code: ${target.code}]. Reason: ${reason || "Administrative removal"}`,
      details: {
        statusId: id,
        entityType: target.entityType,
        code: target.code,
        name: target.name,
        reason: reason || "Administrative removal",
      },
    });
  } catch (auditErr) {
    console.warn("Audit logging warning:", auditErr);
  }

  return { success: true };
}

/**
 * Reset in-memory store for automated test isolation.
 */
export function resetStatusConfigsToDefault() {
  inMemoryStatusStore = [
    ...INITIAL_CASE_STATUSES.map((s) => ({ ...s })),
    ...INITIAL_EVIDENCE_STATUSES.map((s) => ({ ...s })),
  ];
}
