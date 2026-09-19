import { AuthorizationError } from "../auth/middleware";
import { normalizeRole } from "../auth/roles";
import { SystemRole } from "../auth/types";
import { supabase } from "../lib/supabase";
import {
  AuditCategory,
  AuditEvent,
  AuditEventType,
  AuditFilterOptions,
  CreateAuditEventInput,
  PaginatedAuditResponse,
} from "./types";

const SENSITIVE_WORDS = [
  "password",
  "confirmpassword",
  "confirm_password",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "secret",
  "clientsecret",
  "client_secret",
  "apikey",
  "api_key",
  "pin",
  "otp",
  "authorization",
  "bearer",
  "creditcard",
  "credit_card",
  "privatekey",
  "private_key",
  "hash",
];

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

/**
 * Categorizes an AuditEventType into its high-level workflow domain.
 */
export function getEventCategory(eventType: AuditEventType | string): AuditCategory {
  const norm = String(eventType || "").toUpperCase();

  if (
    norm.startsWith("ACCOUNT_") ||
    norm.startsWith("LOGIN_") ||
    norm.startsWith("SIGN_IN_") ||
    norm.startsWith("STAFF_INVITE") ||
    norm.startsWith("STAFF_CREATE") ||
    norm.startsWith("STAFF_ACTIVATE") ||
    norm.startsWith("STAFF_DEACTIVATE")
  ) {
    return "account";
  }

  if (norm.startsWith("ROLE_") || norm.startsWith("STAFF_ROLE_")) {
    return "role";
  }

  if (norm.startsWith("CASE_")) {
    return "case";
  }

  if (norm.startsWith("EVIDENCE_")) {
    return "evidence";
  }

  if (norm.startsWith("STATUS_CONFIG_") || norm.startsWith("CHECKER_AVAILABILITY_")) {
    return "status";
  }

  if (
    norm.startsWith("SECURITY_") ||
    norm.startsWith("UNAUTHORIZED_") ||
    norm.startsWith("BULK_") ||
    norm.includes("VIOLATION") ||
    norm.includes("FAILED") ||
    norm.includes("DENIED")
  ) {
    return "security";
  }

  return "account";
}

/**
 * AC 5 (JN-285): Deeply sanitizes data payloads to ensure credentials,
 * tokens, API keys, and sensitive secrets are never logged or stored.
 */
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

// Initial Comprehensive Mock Audit Events covering AC 4 across all categories
export const INITIAL_MOCK_AUDIT_LOGS: AuditEvent[] = [
  // 1. Account Events
  {
    id: "AUD-2026-9001",
    eventType: "ACCOUNT_CREATED",
    category: "account",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "usr_chk_1024",
    targetEmail: "kavinda.checker@justicenow.org",
    action: "STAFF_CREATE",
    description: "Invited new Evidence Checker Kavinda Perera to the forensic intake squad.",
    details: {
      role: "evidence_checker",
      department: "Digital Forensics",
      invitationMethod: "email_secure_link",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-18T14:30:00Z",
  },
  {
    id: "AUD-2026-9002",
    eventType: "ACCOUNT_ACTIVATED",
    category: "account",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "usr_off_2048",
    targetEmail: "sarah.officer@justicenow.org",
    action: "STAFF_ACTIVATE",
    description: "Reactivated Case Officer account after leave of absence.",
    details: {
      previousStatus: "inactive",
      newStatus: "active",
      reason: "Returned from field deployment",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-18T13:15:00Z",
  },
  {
    id: "AUD-2026-9003",
    eventType: "ACCOUNT_DEACTIVATED",
    category: "account",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "usr_chk_3011",
    targetEmail: "temp.validator@justicenow.org",
    action: "STAFF_DEACTIVATE",
    description: "Suspended validator account following contract conclusion.",
    details: {
      previousStatus: "active",
      newStatus: "inactive",
      reason: "Contract expiration",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-18T11:00:00Z",
  },
  {
    id: "AUD-2026-9004",
    eventType: "LOGIN_SUCCESS",
    category: "account",
    actorId: "usr_off_2048",
    actorEmail: "sarah.officer@justicenow.org",
    actorRole: "case_officer",
    targetId: "usr_off_2048",
    targetEmail: "sarah.officer@justicenow.org",
    action: "LOGIN_SUCCESS",
    description: "Case Officer logged in successfully with MFA token verification.",
    details: {
      authMethod: "password_plus_totp",
      aalLevel: "aal2",
    },
    ipAddress: "172.16.0.42",
    userAgent: "Expo/57.0 (Android 14)",
    timestamp: "2026-09-18T09:20:00Z",
  },

  // 2. Role Events
  {
    id: "AUD-2026-9005",
    eventType: "ROLE_CHANGED",
    category: "role",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "usr_off_2048",
    targetEmail: "sarah.officer@justicenow.org",
    action: "STAFF_ROLE_CHANGE",
    description: "Promoted Case Officer Sarah to Lead Legal Investigator.",
    details: {
      previousRole: "case_officer",
      newRole: "system_admin",
      gainedPermissions: ["admin:users:manage", "admin:roles:manage", "admin:audit:view"],
      reason: "Appointed Head of Intake & Review",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-17T16:45:00Z",
  },
  {
    id: "AUD-2026-9006",
    eventType: "ROLE_ASSIGNED",
    category: "role",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "usr_chk_1024",
    targetEmail: "kavinda.checker@justicenow.org",
    action: "ROLE_ASSIGNED",
    description: "Assigned Evidence Checker capability profile with forensic verification mandate.",
    details: {
      assignedRole: "evidence_checker",
      permissions: ["evidence:verify", "evidence:request_clarification"],
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-17T14:10:00Z",
  },

  // 3. Case Events
  {
    id: "AUD-2026-9007",
    eventType: "CASE_CREATED",
    category: "case",
    actorId: "usr_rep_8842",
    actorEmail: "elena.r@humanrights-monitor.org",
    actorRole: "reporter",
    targetId: "CASE-2026-0812",
    targetEmail: "intake@justicenow.org",
    action: "CASE_SUBMITTED",
    description: "Submitted new case report [CASE-2026-0812]: Arbitrary Detention at Checkpoint #4.",
    details: {
      caseReference: "JN-2026-0812",
      category: "Unlawful Detention",
      urgency: "High",
      jurisdiction: "Northern Sector",
    },
    ipAddress: "198.51.100.24",
    userAgent: "Expo/57.0 (iOS 18.1)",
    timestamp: "2026-09-17T10:05:00Z",
  },
  {
    id: "AUD-2026-9008",
    eventType: "CASE_ASSIGNED",
    category: "case",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "CASE-2026-0812",
    targetEmail: "sarah.officer@justicenow.org",
    action: "CASE_ASSIGNMENT",
    description: "Assigned case [CASE-2026-0812] to Case Officer Sarah for primary investigation.",
    details: {
      caseId: "CASE-2026-0812",
      assignedOfficerId: "usr_off_2048",
      assignedOfficerEmail: "sarah.officer@justicenow.org",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-17T11:30:00Z",
  },
  {
    id: "AUD-2026-9009",
    eventType: "CASE_STATUS_CHANGED",
    category: "case",
    actorId: "usr_off_2048",
    actorEmail: "sarah.officer@justicenow.org",
    actorRole: "case_officer",
    targetId: "CASE-2026-0812",
    targetEmail: "elena.r@humanrights-monitor.org",
    action: "CASE_STATUS_CHANGE",
    description: "Updated case status from 'submitted' to 'investigating' following initial evidence appraisal.",
    details: {
      caseId: "CASE-2026-0812",
      previousStatus: "submitted",
      newStatus: "investigating",
    },
    ipAddress: "172.16.0.42",
    userAgent: "Expo/57.0 (Android 14)",
    timestamp: "2026-09-17T15:20:00Z",
  },
  {
    id: "AUD-2026-9010",
    eventType: "CASE_WITHDRAWAL_REVIEWED",
    category: "case",
    actorId: "usr_off_2048",
    actorEmail: "sarah.officer@justicenow.org",
    actorRole: "case_officer",
    targetId: "CASE-2026-0798",
    targetEmail: "reporter.silva@justicenow.org",
    action: "WITHDRAWAL_REVIEW_DECISION",
    description: "Approved case withdrawal request following formal safety assessment.",
    details: {
      caseId: "CASE-2026-0798",
      decision: "approved",
      decisionReason: "Reporter reached verified civil remediation through ombudsman.",
    },
    ipAddress: "172.16.0.42",
    userAgent: "Expo/57.0 (Android 14)",
    timestamp: "2026-09-16T17:00:00Z",
  },

  // 4. Evidence Events
  {
    id: "AUD-2026-9011",
    eventType: "EVIDENCE_UPLOADED",
    category: "evidence",
    actorId: "usr_rep_8842",
    actorEmail: "elena.r@humanrights-monitor.org",
    actorRole: "reporter",
    targetId: "EVD-2026-9041",
    targetEmail: "intake@justicenow.org",
    action: "EVIDENCE_UPLOAD",
    description: "Uploaded forensic photo [EVD-2026-9041: crime_scene_photo_01.jpg] for case CASE-2026-0812.",
    details: {
      evidenceId: "EVD-2026-9041",
      caseId: "CASE-2026-0812",
      fileType: "image/jpeg",
      fileSizeBytes: 4280000,
    },
    ipAddress: "198.51.100.24",
    userAgent: "Expo/57.0 (iOS 18.1)",
    timestamp: "2026-09-16T14:30:00Z",
  },
  {
    id: "AUD-2026-9012",
    eventType: "EVIDENCE_ASSIGNED",
    category: "evidence",
    actorId: "usr_off_2048",
    actorEmail: "sarah.officer@justicenow.org",
    actorRole: "case_officer",
    targetId: "EVD-2026-9041",
    targetEmail: "kavinda.checker@justicenow.org",
    action: "EVIDENCE_ASSIGNMENT",
    description: "Assigned evidence [EVD-2026-9041] to Evidence Checker Kavinda for metadata verification.",
    details: {
      evidenceId: "EVD-2026-9041",
      checkerId: "usr_chk_1024",
      caseId: "CASE-2026-0812",
    },
    ipAddress: "172.16.0.42",
    userAgent: "Expo/57.0 (Android 14)",
    timestamp: "2026-09-16T14:35:00Z",
  },
  {
    id: "AUD-2026-9013",
    eventType: "EVIDENCE_VERIFIED",
    category: "evidence",
    actorId: "usr_chk_1024",
    actorEmail: "kavinda.checker@justicenow.org",
    actorRole: "evidence_checker",
    targetId: "EVD-2026-9043",
    targetEmail: "sarah.officer@justicenow.org",
    action: "EVIDENCE_APPROVED",
    description: "Verified authenticity & chain of custody for Medical Report [EVD-2026-9043].",
    details: {
      evidenceId: "EVD-2026-9043",
      decision: "approved",
      verificationNote: "Clinic digital signature verified against hospital registry.",
    },
    ipAddress: "192.168.2.15",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-16T16:10:00Z",
  },
  {
    id: "AUD-2026-9014",
    eventType: "EVIDENCE_REJECTED",
    category: "evidence",
    actorId: "usr_chk_1024",
    actorEmail: "kavinda.checker@justicenow.org",
    actorRole: "evidence_checker",
    targetId: "EVD-2026-9047",
    targetEmail: "tariq.m@justicenow.org",
    action: "EVIDENCE_REJECTED",
    description: "Rejected corrupt 0-byte file [EVD-2026-9047: empty_log_file.jpg].",
    details: {
      evidenceId: "EVD-2026-9047",
      decision: "rejected",
      rejectionReason: "Zero-byte corrupt media file",
    },
    ipAddress: "192.168.2.15",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-15T18:22:00Z",
  },
  {
    id: "AUD-2026-9015",
    eventType: "EVIDENCE_CLARIFICATION_REQUESTED",
    category: "evidence",
    actorId: "usr_chk_1024",
    actorEmail: "kavinda.checker@justicenow.org",
    actorRole: "evidence_checker",
    targetId: "EVD-2026-9041",
    targetEmail: "sarah.officer@justicenow.org",
    action: "CLARIFICATION_REQUESTED",
    description: "Requested high-resolution re-upload for blurry checkpoint photo [EVD-2026-9041].",
    details: {
      evidenceId: "EVD-2026-9041",
      requestType: "replacement",
      reason: "Crime scene photo is low resolution and truncated at lower margin.",
    },
    ipAddress: "192.168.2.15",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-15T19:00:00Z",
  },

  // 5. Status & Configuration Events
  {
    id: "AUD-2026-9016",
    eventType: "STATUS_CONFIG_CREATED",
    category: "status",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "stat_case_action_taken",
    targetEmail: "system@justicenow.org",
    action: "STATUS_CONFIG_CREATED",
    description: "Created new Case workflow status 'Action Taken' [code: action_taken].",
    details: {
      statusId: "stat_case_action_taken",
      entityType: "case",
      code: "action_taken",
      tone: "success",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-15T09:30:00Z",
  },
  {
    id: "AUD-2026-9017",
    eventType: "STATUS_CONFIG_ACTIVATED",
    category: "status",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "stat_ev_escalated",
    targetEmail: "system@justicenow.org",
    action: "STATUS_CONFIG_ACTIVATED",
    description: "Activated Evidence status 'Escalated for Secondary Review'.",
    details: {
      statusId: "stat_ev_escalated",
      entityType: "evidence",
      code: "escalated",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-14T11:40:00Z",
  },
  {
    id: "AUD-2026-9018",
    eventType: "CHECKER_AVAILABILITY_CHANGED",
    category: "status",
    actorId: "usr_admin_01",
    actorEmail: "admin@justicenow.org",
    actorRole: "system_admin",
    targetId: "usr_chk_1024",
    targetEmail: "kavinda.checker@justicenow.org",
    action: "CHECKER_STATUS_TOGGLED",
    description: "Updated Evidence Checker status to 'available' for assignment queue.",
    details: {
      checkerId: "usr_chk_1024",
      previousStatus: "away",
      newStatus: "available",
    },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExpoWeb/1.0",
    timestamp: "2026-09-14T08:15:00Z",
  },

  // 6. Security Events
  {
    id: "AUD-2026-9019",
    eventType: "SECURITY_POLICY_VIOLATION",
    category: "security",
    actorId: "203.94.45.18",
    actorEmail: "unknown@attacker.net",
    actorRole: "reporter",
    targetId: "usr_off_2048",
    targetEmail: "sarah.officer@justicenow.org",
    action: "LOGIN_FAILED",
    description: "11 repeated failed sign-in attempts against investigator account within 6 minutes.",
    details: {
      failedAttempts: 11,
      lockoutApplied: true,
      threatScore: "critical",
    },
    ipAddress: "203.94.45.18",
    userAgent: "Python-urllib/3.9",
    timestamp: "2026-09-13T13:12:00Z",
  },
  {
    id: "AUD-2026-9020",
    eventType: "UNAUTHORIZED_ACCESS_ATTEMPT",
    category: "security",
    actorId: "usr_rep_8842",
    actorEmail: "elena.r@humanrights-monitor.org",
    actorRole: "reporter",
    targetId: "admin_audit_logs",
    targetEmail: "system@justicenow.org",
    action: "ACCESS_DENIED",
    description: "Blocked unauthorized API call to '/admin/audit' by non-administrator user role.",
    details: {
      requiredRole: "system_admin",
      userRole: "reporter",
      route: "/admin/audit",
    },
    ipAddress: "198.51.100.24",
    userAgent: "Expo/57.0 (iOS 18.1)",
    timestamp: "2026-09-13T09:40:00Z",
  },
  {
    id: "AUD-2026-9021",
    eventType: "BULK_FILE_ACCESS",
    category: "security",
    actorId: "usr_chk_3011",
    actorEmail: "temp.validator@justicenow.org",
    actorRole: "evidence_checker",
    targetId: "evidence_archive_bucket",
    targetEmail: "security@justicenow.org",
    action: "UNUSUAL_FILE_ACCESS",
    description: "Anomalous bulk download trigger: 48 evidence files accessed in 9 minutes outside operating hours.",
    details: {
      filesAccessedCount: 48,
      downloadDurationSeconds: 540,
      alertId: "SA-3311",
    },
    ipAddress: "112.134.88.92",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    timestamp: "2026-09-12T22:05:00Z",
  },
];

// In-memory audit store
let inMemoryAuditStore: AuditEvent[] = [...INITIAL_MOCK_AUDIT_LOGS.map((e) => ({ ...e }))];

function mapAuditRow(row: any): AuditEvent {
  const role = normalizeRole(row.actor_role) || "system_admin";
  const eventType = String(row.event_type || "SECURITY_POLICY_VIOLATION") as AuditEventType;

  return {
    id: String(row.id),
    eventType,
    category: getEventCategory(eventType),
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

/**
 * AC 1 & AC 6 & JN-284: Strict Administrator Role Authorization Guard.
 */
export function requireAdministrator(actorRole?: string) {
  if (normalizeRole(actorRole) !== "system_admin") {
    throw new AuthorizationError(
      "Unauthorized: Only System Administrators can access system audit entries.",
      "UNAUTHORIZED_AUDIT_ACCESS",
      403,
    );
  }
}

/**
 * Appends an audit event to database and in-memory store.
 */
export async function recordAuditEvent(
  input: CreateAuditEventInput,
): Promise<AuditEvent> {
  const sanitizedDetails = sanitizeAuditDetails(input.details);
  const now = new Date().toISOString();

  const newEvent: AuditEvent = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    eventType: input.eventType,
    category: getEventCategory(input.eventType),
    actorId: input.actorId || "admin-system",
    actorEmail: input.actorEmail,
    actorRole: (input.actorRole as SystemRole) || "system_admin",
    targetId: input.targetId || "system",
    targetEmail: input.targetEmail,
    action: input.action,
    description: input.description,
    details: sanitizedDetails,
    ipAddress: input.ipAddress || "127.0.0.1",
    userAgent: input.userAgent || "JusticeNow-App/1.0",
    timestamp: now,
  };

  inMemoryAuditStore.unshift(newEvent);

  try {
    const { data, error } = await supabase.rpc("record_staff_audit_event", {
      p_event_type: input.eventType,
      p_target_user_id: isUuid(input.targetId) ? input.targetId : null,
      p_target_user_email: input.targetEmail || null,
      p_action: input.action || null,
      p_description: input.description || null,
      p_details: sanitizedDetails,
    });

    if (!error && data) {
      return mapAuditRow(data);
    }
  } catch (err) {
    console.warn("Supabase audit insert warning (using fallback):", err);
  }

  return newEvent;
}

/**
 * JN-280 & JN-282: Retrieve filtered audit events with in-memory fallback.
 */
export async function getAuditEvents(
  filter?: AuditFilterOptions,
  actorRole = "system_admin",
): Promise<AuditEvent[]> {
  requireAdministrator(actorRole);

  try {
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

    if (error || !data || data.length === 0) {
      return filterEventsInMemory(filter);
    }

    const events = (data ?? []).map(mapAuditRow);
    return filterEventsList(events, filter);
  } catch {
    return filterEventsInMemory(filter);
  }
}

/**
 * JN-280 & JN-283: Retrieve paginated audit events with total count.
 */
export async function getPaginatedAuditEvents(
  filter?: AuditFilterOptions,
  actorRole = "system_admin",
): Promise<PaginatedAuditResponse> {
  requireAdministrator(actorRole);

  const allFiltered = await getAuditEvents(filter, actorRole);
  const totalCount = allFiltered.length;

  const pageSize = Math.max(filter?.pageSize || 10, 1);
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const page = Math.min(Math.max(filter?.page || 1, 1), totalPages);

  const startIndex = (page - 1) * pageSize;
  const events = allFiltered.slice(startIndex, startIndex + pageSize);

  return {
    events,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

function filterEventsInMemory(filter?: AuditFilterOptions): AuditEvent[] {
  return filterEventsList([...inMemoryAuditStore], filter);
}

function filterEventsList(
  events: AuditEvent[],
  filter?: AuditFilterOptions,
): AuditEvent[] {
  let result = events;

  // 1. Category Filter (AC 4)
  if (filter?.category && filter.category !== "all") {
    result = result.filter(
      (e) => (e.category || getEventCategory(e.eventType)) === filter.category,
    );
  }

  // 2. Specific Event Type Filter
  if (filter?.eventType && filter.eventType !== "ALL") {
    result = result.filter((e) => e.eventType === filter.eventType);
  }

  // 3. Result Filter (Success vs Failure)
  if (filter?.result && filter.result !== "all") {
    result = result.filter((e) => {
      const isFail =
        e.eventType.includes("FAIL") ||
        e.eventType.includes("VIOLATION") ||
        e.eventType.includes("DENIED") ||
        e.action.includes("FAILED") ||
        e.action.includes("DENIED");
      return filter.result === "failure" ? isFail : !isFail;
    });
  }

  // 4. Actor Email Filter (AC 3)
  if (filter?.actorEmail?.trim()) {
    const val = filter.actorEmail.trim().toLowerCase();
    result = result.filter((e) => e.actorEmail.toLowerCase().includes(val));
  }

  // 5. Target Email Filter (AC 3)
  if (filter?.targetEmail?.trim()) {
    const val = filter.targetEmail.trim().toLowerCase();
    result = result.filter((e) => e.targetEmail.toLowerCase().includes(val));
  }

  // 6. General Keyword Search (AC 3)
  if (filter?.searchQuery?.trim()) {
    const val = filter.searchQuery.trim().toLowerCase();
    result = result.filter((e) =>
      [
        e.id,
        e.eventType,
        e.category,
        e.action,
        e.description,
        e.actorEmail,
        e.actorRole,
        e.targetId,
        e.targetEmail,
        JSON.stringify(e.details),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(val),
    );
  }

  return result.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function getAuditEventById(
  id: string,
  actorRole = "system_admin",
): Promise<AuditEvent | null> {
  requireAdministrator(actorRole);

  try {
    const { data, error } = await supabase
      .from("staff_audit_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return mapAuditRow(data);
    }
  } catch (err) {
    console.warn("Supabase lookup fallback:", err);
  }

  return inMemoryAuditStore.find((e) => e.id === id) || null;
}

/**
 * Resets in-memory audit store for automated test isolation.
 */
export function resetAuditStoreToDefault() {
  inMemoryAuditStore = [...INITIAL_MOCK_AUDIT_LOGS.map((e) => ({ ...e }))];
}

export const resetAuditStoreForTesting = resetAuditStoreToDefault;