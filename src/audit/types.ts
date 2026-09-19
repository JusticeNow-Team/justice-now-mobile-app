import { SystemRole } from "../auth/types";

export type AuditCategory =
  | "all"
  | "account"
  | "role"
  | "case"
  | "evidence"
  | "status"
  | "security";

export type AuditResultFilter = "all" | "success" | "failure";

export type AuditEventType =
  // Account Events
  | "ACCOUNT_CREATED"
  | "ACCOUNT_ACTIVATED"
  | "ACCOUNT_DEACTIVATED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "SIGN_IN_ATTEMPT"
  // Role Events
  | "ROLE_ASSIGNED"
  | "ROLE_CHANGED"
  // Case Events
  | "CASE_CREATED"
  | "CASE_STATUS_CHANGED"
  | "CASE_ASSIGNED"
  | "CASE_WITHDRAWAL_REVIEWED"
  // Evidence Events
  | "EVIDENCE_UPLOADED"
  | "EVIDENCE_ASSIGNED"
  | "EVIDENCE_VERIFIED"
  | "EVIDENCE_REJECTED"
  | "EVIDENCE_CLARIFICATION_REQUESTED"
  // Status Configuration Events
  | "STATUS_CONFIG_CREATED"
  | "STATUS_CONFIG_UPDATED"
  | "STATUS_CONFIG_ACTIVATED"
  | "STATUS_CONFIG_DEACTIVATED"
  | "STATUS_CONFIG_DELETED"
  | "CHECKER_AVAILABILITY_CHANGED"
  // Security & Policy Events
  | "SECURITY_POLICY_VIOLATION"
  | "UNAUTHORIZED_ACCESS_ATTEMPT"
  | "BULK_FILE_ACCESS";
  | "STATUS_CONFIG_CREATED"
  | "STATUS_CONFIG_UPDATED"
  | "STATUS_CONFIG_ACTIVATED"
  | "STATUS_CONFIG_DEACTIVATED"
  | "STATUS_CONFIG_DELETED"
  | "SECURITY_POLICY_VIOLATION";

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  category?: AuditCategory;
  actorId: string;
  actorEmail: string;
  actorRole: SystemRole;
  targetId: string;
  targetEmail: string;
  action: string;
  description: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface CreateAuditEventInput {
  eventType: AuditEventType;
  actorId?: string;
  actorEmail: string;
  actorRole?: SystemRole;
  targetId?: string;
  targetEmail: string;
  action: string;
  description: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFilterOptions {
  eventType?: AuditEventType | "ALL";
  category?: AuditCategory;
  result?: AuditResultFilter;
  actorEmail?: string;
  targetEmail?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedAuditResponse {
  events: AuditEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
