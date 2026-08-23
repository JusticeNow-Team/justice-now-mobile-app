import { AuthorizationError } from "../auth/middleware";
import { normalizeRole } from "../auth/roles";
import { supabase } from "../lib/supabase";
import { INITIAL_AUDIT_EVENTS } from "./seeds/auditSeed";
import { AuditEvent, AuditFilterOptions, CreateAuditEventInput } from "./types";

const SENSITIVE_KEYS = new Set([
  "password",
  "confirmPassword",
  "token",
  "refreshToken",
  "accessToken",
  "secret",
  "apiKey",
  "pin",
  "otp",
  "hash",
  "authHeader",
  "authorization",
  "creditCard",
]);

/**
 * Deeply sanitizes an object to redact sensitive passwords, secrets, or tokens (JN-254 & AC 6).
 */
export function sanitizeAuditDetails(data?: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== "object") return {};

  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    if (SENSITIVE_KEYS.has(key) || Array.from(SENSITIVE_KEYS).some((s) => lowerKey.includes(s.toLowerCase()))) {
      clean[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitizeAuditDetails(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) =>
        typeof item === "object" ? sanitizeAuditDetails(item) : item
      );
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

let inMemoryAuditLogs: AuditEvent[] = [...INITIAL_AUDIT_EVENTS];

/**
 * Records a new immutable audit event (JN-254, AC 1-4, AC 6).
 */
export async function recordAuditEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
  const sanitizedDetails = sanitizeAuditDetails(input.details);

  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    eventType: input.eventType,
    actorId: input.actorId || "00000000-0000-0000-0000-000000000001",
    actorEmail: input.actorEmail,
    actorRole: input.actorRole || "system_admin",
    targetId: input.targetId || "00000000-0000-0000-0000-000000000000",
    targetEmail: input.targetEmail,
    action: input.action,
    description: input.description,
    details: sanitizedDetails,
    ipAddress: input.ipAddress || "127.0.0.1",
    userAgent: input.userAgent || "JusticeNow System Admin Client",
    timestamp: new Date().toISOString(),
  };

  // Prepend to in-memory store
  inMemoryAuditLogs = [event, ...inMemoryAuditLogs];

  // If Supabase is connected, write to audit_events table
  if (supabase) {
    try {
      await supabase.from("staff_audit_logs").insert([
        {
          id: event.id,
          event_type: event.eventType,
          actor_id: event.actorId,
          actor_email: event.actorEmail,
          target_user_id: event.targetId,
          target_user_email: event.targetEmail,
          action: event.action,
          description: event.description,
          details: event.details,
          created_at: event.timestamp,
        },
      ]);
    } catch (err) {
      console.warn("Supabase audit log insert fallback to in-memory:", err);
    }
  }

  return event;
}

/**
 * Retrieves audit log entries with administrator access control (JN-254 & AC 7).
 */
export async function getAuditEvents(
  filter?: AuditFilterOptions,
  actorRole: string = "system_admin"
): Promise<AuditEvent[]> {
  const normalized = normalizeRole(actorRole);

  // AC 7: Only authorized administrators can view audit entries
  if (normalized !== "system_admin") {
    throw new AuthorizationError(
      "Unauthorized: Only System Administrators can access system audit entries.",
      "UNAUTHORIZED_AUDIT_ACCESS",
      403
    );
  }

  let events = [...inMemoryAuditLogs];

  if (filter?.eventType && filter.eventType !== "ALL") {
    events = events.filter((e) => e.eventType === filter.eventType);
  }

  if (filter?.actorEmail) {
    const email = filter.actorEmail.toLowerCase();
    events = events.filter((e) => e.actorEmail.toLowerCase().includes(email));
  }

  if (filter?.targetEmail) {
    const email = filter.targetEmail.toLowerCase();
    events = events.filter((e) => e.targetEmail.toLowerCase().includes(email));
  }

  if (filter?.searchQuery?.trim()) {
    const query = filter.searchQuery.toLowerCase().trim();
    events = events.filter(
      (e) =>
        e.description.toLowerCase().includes(query) ||
        e.action.toLowerCase().includes(query) ||
        e.actorEmail.toLowerCase().includes(query) ||
        e.targetEmail.toLowerCase().includes(query)
    );
  }

  return events;
}
