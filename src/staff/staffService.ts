import { recordAuditEvent } from "../audit/auditService";
import { supabase } from "../lib/supabase";
import { INITIAL_STAFF_ACCOUNTS } from "./seeds/staffSeed";
import {
  CreateStaffInput,
  StaffAccount,
  StaffAuditLog,
  StaffFilterOptions,
} from "./types";
import { checkDuplicateStaffEmail, validateStaffInput } from "./validation";

// In-memory runtime cache for responsive UI and offline testing
let inMemoryStaff: StaffAccount[] = [...INITIAL_STAFF_ACCOUNTS];
let inMemoryAuditLogs: StaffAuditLog[] = [
  {
    id: "audit_init_01",
    eventType: "STAFF_ACCOUNT_CREATED",
    actorId: "system_bootstrap",
    actorEmail: "system@justicenow.org",
    targetStaffId: "staff_admin_01",
    targetStaffEmail: "admin@justicenow.org",
    description: "System initialized default System Administrator account.",
    timestamp: "2026-01-01T00:00:00Z",
  },
  {
    id: "audit_init_02",
    eventType: "STAFF_ACCOUNT_CREATED",
    actorId: "staff_admin_01",
    actorEmail: "admin@justicenow.org",
    targetStaffId: "staff_officer_01",
    targetStaffEmail: "officer.silva@justicenow.org",
    description: "Administrator created Case Officer account for Investigator K. Silva.",
    timestamp: "2026-01-15T08:00:00Z",
  },
  {
    id: "audit_init_03",
    eventType: "STAFF_ACCOUNT_DEACTIVATED",
    actorId: "staff_admin_01",
    actorEmail: "admin@justicenow.org",
    targetStaffId: "staff_officer_inactive",
    targetStaffEmail: "former.officer@justicenow.org",
    description: "Administrator deactivated account following staff departure.",
    details: { reason: "Staff departure" },
    timestamp: "2026-03-02T09:00:00Z",
  },
];

/**
 * Resets the in-memory cache to the default seed state (used in automated tests).
 */
export function resetStaffToDefault() {
  inMemoryStaff = [...INITIAL_STAFF_ACCOUNTS];
  inMemoryAuditLogs = [
    {
      id: "audit_init_01",
      eventType: "STAFF_ACCOUNT_CREATED",
      actorId: "system_bootstrap",
      actorEmail: "system@justicenow.org",
      targetStaffId: "staff_admin_01",
      targetStaffEmail: "admin@justicenow.org",
      description: "System initialized default System Administrator account.",
      timestamp: "2026-01-01T00:00:00Z",
    },
  ];
}

/**
 * Retrieves all staff accounts, with optional role/status/search filtering.
 */
export async function getStaffAccounts(
  options: StaffFilterOptions = {}
): Promise<StaffAccount[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, email, is_active, status, department, phone, created_at, updated_at")
      .in("role", ["case_officer", "evidence_checker", "evidence_validator", "system_admin"])
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped: StaffAccount[] = data.map((row: any) => ({
        id: row.id,
        email: row.email || `${row.id}@justicenow.org`,
        fullName: row.full_name || "Staff Member",
        role: row.role === "evidence_validator" ? "evidence_checker" : row.role,
        isActive: row.is_active !== false && row.status !== "inactive",
        status: row.status || (row.is_active === false ? "inactive" : "active"),
        department: row.department,
        phone: row.phone,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      }));

      inMemoryStaff = mapped;
    }
  } catch (err) {
    console.warn("Supabase fetch failed; using in-memory staff cache:", err);
  }

  let result = [...inMemoryStaff];

  if (options.role && options.role !== "all") {
    result = result.filter((s) => s.role === options.role);
  }

  if (options.status && options.status !== "all") {
    result = result.filter((s) =>
      options.status === "active" ? s.isActive : !s.isActive
    );
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.department && s.department.toLowerCase().includes(q))
    );
  }

  return result;
}

/**
 * Retrieves a single staff account by ID.
 */
export async function getStaffAccountById(
  id: string
): Promise<StaffAccount | null> {
  const staffList = await getStaffAccounts();
  return staffList.find((s) => s.id === id) || null;
}

/**
 * Creates or invites a new staff account.
 * Rejects invalid fields or duplicate email addresses.
 */
export async function createStaffAccount(
  input: CreateStaffInput,
  actorEmail = "admin@justicenow.org"
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  const validation = validateStaffInput(input);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(" ") };
  }

  const dupCheck = checkDuplicateStaffEmail(input.email, inMemoryStaff);
  if (dupCheck.isDuplicate) {
    return { success: false, error: dupCheck.error };
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.fullName.trim();
  const newId = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newStaff: StaffAccount = {
    id: newId,
    email: cleanEmail,
    fullName: cleanName,
    role: input.role,
    isActive: input.isActive !== false,
    status: input.isActive === false ? "inactive" : "active",
    department: input.department?.trim(),
    phone: input.phone?.trim(),
    createdAt: now,
    updatedAt: now,
    createdBy: actorEmail,
  };

  // Add to local cache
  inMemoryStaff.unshift(newStaff);

  // Record audit log event (JN-197 & JN-255)
  const auditEvent: StaffAuditLog = {
    id: `audit_${Date.now()}`,
    eventType: "STAFF_ACCOUNT_CREATED",
    actorId: "current_admin",
    actorEmail,
    targetStaffId: newId,
    targetStaffEmail: cleanEmail,
    description: `Created new staff account for ${cleanName} with role "${input.role}".`,
    details: { role: input.role, department: input.department },
    timestamp: now,
  };
  inMemoryAuditLogs.unshift(auditEvent);

  try {
    void recordAuditEvent({
      eventType: "ACCOUNT_CREATED",
      actorEmail,
      targetId: newId,
      targetEmail: cleanEmail,
      action: "STAFF_CREATE",
      description: auditEvent.description,
      details: { role: input.role, department: input.department, fullName: cleanName },
    });
  } catch {
    // Non-fatal
  }

  // Sync with Supabase
  try {
    await supabase.from("profiles").insert({
      id: newId,
      full_name: cleanName,
      email: cleanEmail,
      role: input.role,
      is_active: newStaff.isActive,
      status: newStaff.status,
      department: newStaff.department,
      phone: newStaff.phone,
      created_at: now,
      updated_at: now,
    });

    await supabase.from("staff_audit_logs").insert({
      id: auditEvent.id,
      event_type: auditEvent.eventType,
      actor_email: actorEmail,
      target_staff_id: newId,
      target_staff_email: cleanEmail,
      description: auditEvent.description,
      details: auditEvent.details,
      created_at: now,
    });
  } catch (err) {
    console.warn("Supabase insert skipped in offline mode:", err);
  }

  return { success: true, staff: newStaff };
}

/**
 * Activates or deactivates an existing staff account.
 * Logs the audit event.
 */
export async function toggleStaffActive(
  id: string,
  isActive: boolean,
  actorEmail = "admin@justicenow.org",
  reason?: string
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  const index = inMemoryStaff.findIndex((s) => s.id === id);
  if (index === -1) {
    return { success: false, error: "Staff account not found." };
  }

  const current = inMemoryStaff[index];
  const now = new Date().toISOString();

  const updated: StaffAccount = {
    ...current,
    isActive,
    status: isActive ? "active" : "inactive",
    updatedAt: now,
  };

  inMemoryStaff[index] = updated;

  // Record audit log event (JN-197)
  const eventType = isActive
    ? "STAFF_ACCOUNT_ACTIVATED"
    : "STAFF_ACCOUNT_DEACTIVATED";

  const description = isActive
    ? `Activated staff account for ${current.fullName} (${current.email}).`
    : `Deactivated staff account for ${current.fullName} (${current.email}). Reason: ${reason || "Administrative action"}`;

  const auditEvent: StaffAuditLog = {
    id: `audit_${Date.now()}`,
    eventType,
    actorId: "current_admin",
    actorEmail,
    targetStaffId: current.id,
    targetStaffEmail: current.email,
    description,
    details: { previousStatus: current.status, newStatus: updated.status, reason },
    timestamp: now,
  };
  inMemoryAuditLogs.unshift(auditEvent);

  try {
    void recordAuditEvent({
      eventType: isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
      actorEmail,
      targetId: current.id,
      targetEmail: current.email,
      action: isActive ? "STAFF_ACTIVATE" : "STAFF_DEACTIVATE",
      description,
      details: { previousStatus: current.status, newStatus: updated.status, reason },
    });
  } catch {
    // Non-fatal
  }

  // Sync with Supabase
  try {
    await supabase
      .from("profiles")
      .update({
        is_active: isActive,
        status: updated.status,
        updated_at: now,
      })
      .eq("id", id);

    await supabase.from("staff_audit_logs").insert({
      id: auditEvent.id,
      event_type: eventType,
      actor_email: actorEmail,
      target_staff_id: current.id,
      target_staff_email: current.email,
      description,
      details: auditEvent.details,
      created_at: now,
    });
  } catch (err) {
    console.warn("Supabase update skipped in offline mode:", err);
  }

  return { success: true, staff: updated };
}

/**
 * Returns the immutable staff audit log history (JN-197).
 */
export async function getStaffAuditLogs(): Promise<StaffAuditLog[]> {
  try {
    const { data, error } = await supabase
      .from("staff_audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        eventType: row.event_type,
        actorId: row.actor_id || "admin",
        actorEmail: row.actor_email || "admin@justicenow.org",
        targetStaffId: row.target_staff_id,
        targetStaffEmail: row.target_staff_email,
        description: row.description,
        details: row.details,
        timestamp: row.created_at,
      }));
    }
  } catch (err) {
    console.warn("Supabase audit log fetch skipped:", err);
  }

  return [...inMemoryAuditLogs];
}
