import { supabase } from "../lib/supabase";
import { normalizeRole } from "../auth/roles";
import {
  CreateStaffInput,
  StaffAccount,
  StaffAuditLog,
  StaffFilterOptions,
  StaffRole,
  StaffStatus,
} from "./types";
import { checkDuplicateStaffEmail, validateStaffInput } from "./validation";

function frontendRole(role: string): StaffRole {
  const normalized = normalizeRole(role);
  return (normalized || "reporter") as StaffRole;
}

function validStatus(value: unknown, isActive: boolean): StaffStatus {
  if (value === "active" || value === "inactive" || value === "suspended") {
    return value;
  }
  return isActive ? "active" : "inactive";
}

function mapStaff(row: any): StaffAccount {
  const isActive = row.is_active !== false;

  return {
    id: row.id,
    email: row.email || "",
    fullName: row.full_name || "Staff Member",
    role: frontendRole(row.role),
    isActive,
    status: validStatus(row.status, isActive),
    department: row.department || undefined,
    phone: row.phone || undefined,
    lastLoginAt: row.last_login_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function isKnownStaffRole(role: string | null | undefined): role is StaffRole {
  return normalizeRole(role) !== null;
}

async function edgeErrorMessage(error: any, data: any, fallback: string) {
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
    // The generic SDK message below is still useful.
  }

  return error?.message || fallback;
}

export function resetStaffToDefault() {
  // Kept for compatibility with older imports. Production data is never reset.
}

export async function getStaffAccounts(
  options: StaffFilterOptions = {},
): Promise<StaffAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, email, is_active, status, department, phone, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load staff accounts: ${error.message}`);
  }

  let result = (data ?? [])
    .filter((row: any) => isKnownStaffRole(row.role))
    .map(mapStaff);

  if (options.role && options.role !== "all") {
    result = result.filter((staff) => staff.role === options.role);
  }

  if (options.status && options.status !== "all") {
    result = result.filter((staff) =>
      options.status === "active" ? staff.isActive : !staff.isActive,
    );
  }

  if (options.searchQuery?.trim()) {
    const value = options.searchQuery.trim().toLowerCase();
    result = result.filter((staff) =>
      [staff.fullName, staff.email, staff.department || "", staff.id]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }

  return result;
}

export async function getStaffAccountById(
  id: string,
): Promise<StaffAccount | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, email, is_active, status, department, phone, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load the staff account: ${error.message}`);
  }

  return data ? mapStaff(data) : null;
}

export async function createStaffAccount(
  input: CreateStaffInput,
  _actorEmail?: string,
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  const validation = validateStaffInput(input);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(" ") };
  }

  if (!input.password || input.password.length < 6) {
    return {
      success: false,
      error: "Temporary password must contain at least 6 characters.",
    };
  }

  try {
    const current = await getStaffAccounts();
    const duplicate = checkDuplicateStaffEmail(input.email, current);
    if (duplicate.isDuplicate) {
      return { success: false, error: duplicate.error };
    }

    const { data, error } = await supabase.functions.invoke("admin-staff", {
      body: {
        action: "create",
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        password: input.password,
        department: input.department?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        isActive: input.isActive !== false,
      },
    });

    if (error || !data?.staff) {
      return {
        success: false,
        error: await edgeErrorMessage(
          error,
          data,
          "Unable to create the staff account.",
        ),
      };
    }

    return { success: true, staff: mapStaff(data.staff) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to create the staff account.",
    };
  }
}

export async function toggleStaffActive(
  id: string,
  isActive: boolean,
  _actorEmail?: string,
  reason?: string,
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("admin-staff", {
      body: {
        action: "set_active",
        staffId: id,
        isActive,
        reason: reason?.trim() || "Administrative action",
      },
    });

    if (error || !data?.staff) {
      return {
        success: false,
        error: await edgeErrorMessage(
          error,
          data,
          "Unable to update the staff account.",
        ),
      };
    }

    return { success: true, staff: mapStaff(data.staff) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to update the staff account.",
    };
  }
}

export async function getStaffAuditLogs(): Promise<StaffAuditLog[]> {
  const { data, error } = await supabase
    .from("staff_audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load staff audit logs: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    eventType: row.event_type,
    actorId: row.actor_id || "system",
    actorEmail: row.actor_email || "system@justicenow.org",
    targetStaffId:
      row.target_user_id || row.target_staff_id || row.target_id || "system",
    targetStaffEmail:
      row.target_user_email ||
      row.target_staff_email ||
      row.target_email ||
      "unknown@justicenow.org",
    description: row.description || row.action || "Staff activity recorded.",
    details: row.details || {},
    timestamp: row.created_at || new Date().toISOString(),
  }));
}
