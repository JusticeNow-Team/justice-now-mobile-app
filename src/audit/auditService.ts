import { AuthorizationError } from "../auth/middleware";
import { normalizeRole } from "../auth/roles";
import { SystemRole } from "../auth/types";
import { supabase } from "../lib/supabase";
import { AuditEvent, AuditFilterOptions, CreateAuditEventInput } from "./types";

const SENSITIVE_WORDS = [
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "pin",
  "otp",
  "authorization",
  "creditcard",
  "credit_card",
];

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

export function sanitizeAuditDetails(
  data?: Record<string, unknown>,
): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {};
  }

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (SENSITIVE_WORDS.some((word) => normalizedKey.includes(word))) {
      clean[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) =>
        item && typeof item === "object"
          ? sanitizeAuditDetails(item as Record<string, unknown>)
          : item,
      );
    } else if (value && typeof value === "object") {
      clean[key] = sanitizeAuditDetails(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

function mapAuditRow(row: any): AuditEvent {
  const role = normalizeRole(row.actor_role) || "system_admin";

  return {
    id: String(row.id),
    eventType: String(row.event_type || "SECURITY_POLICY_VIOLATION") as AuditEvent["eventType"],
    actorId: row.actor_id || "system",
    actorEmail: row.actor_email || "system@justicenow.org",
    actorRole: role as SystemRole,
    targetId:
      row.target_user_id || row.target_staff_id || row.target_id || "system",
    targetEmail:
      row.target_user_email ||
      row.target_staff_email ||
      row.target_email ||
      "unknown@justicenow.org",
    action: row.action || row.event_type || "AUDIT_EVENT",
    description: row.description || "System activity was recorded.",
    details:
      row.details && typeof row.details === "object" ? row.details : {},
    ipAddress: row.ip_address || undefined,
    userAgent: row.user_agent || undefined,
    timestamp: row.created_at || new Date().toISOString(),
  };
}

function requireAdministrator(actorRole: string) {
  if (normalizeRole(actorRole) !== "system_admin") {
    throw new AuthorizationError(
      "Only System Administrators can access system audit entries.",
      "UNAUTHORIZED_AUDIT_ACCESS",
      403,
    );
  }
}

export async function recordAuditEvent(
  input: CreateAuditEventInput,
): Promise<AuditEvent> {
  const { data, error } = await supabase.rpc("record_staff_audit_event", {
    p_event_type: input.eventType,
    p_target_user_id: isUuid(input.targetId) ? input.targetId : null,
    p_target_user_email: input.targetEmail || null,
    p_action: input.action || null,
    p_description: input.description || null,
    p_details: sanitizeAuditDetails(input.details),
  });

  if (error) {
    throw new Error(`Unable to record audit event: ${error.message}`);
  }

  return mapAuditRow(data);
}

export async function getAuditEvents(
  filter?: AuditFilterOptions,
  actorRole = "system_admin",
): Promise<AuditEvent[]> {
  requireAdministrator(actorRole);

  const offset = Math.max(filter?.offset ?? 0, 0);
  const limit = Math.min(Math.max(filter?.limit ?? 200, 1), 500);

  let query = supabase
    .from("staff_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter?.eventType && filter.eventType !== "ALL") {
    query = query.eq("event_type", filter.eventType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load audit logs: ${error.message}`);
  }

  let events = (data ?? []).map(mapAuditRow);

  if (filter?.actorEmail?.trim()) {
    const value = filter.actorEmail.trim().toLowerCase();
    events = events.filter((event) =>
      event.actorEmail.toLowerCase().includes(value),
    );
  }

  if (filter?.targetEmail?.trim()) {
    const value = filter.targetEmail.trim().toLowerCase();
    events = events.filter((event) =>
      event.targetEmail.toLowerCase().includes(value),
    );
  }

  if (filter?.searchQuery?.trim()) {
    const value = filter.searchQuery.trim().toLowerCase();
    events = events.filter((event) =>
      [
        event.eventType,
        event.action,
        event.description,
        event.actorEmail,
        event.targetEmail,
        event.targetId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }

  return events;
}

export async function getAuditEventById(
  id: string,
  actorRole = "system_admin",
): Promise<AuditEvent | null> {
  requireAdministrator(actorRole);

  const { data, error } = await supabase
    .from("staff_audit_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load the audit entry: ${error.message}`);
  }

  return data ? mapAuditRow(data) : null;
}