import { SystemRole } from "../auth/types";

export type AuditEventType =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_ACTIVATED"
  | "ACCOUNT_DEACTIVATED"
  | "ROLE_ASSIGNED"
  | "ROLE_CHANGED"
  | "CHECKER_AVAILABILITY_CHANGED"
  | "STATUS_CONFIG_CREATED"
  | "STATUS_CONFIG_UPDATED"
  | "STATUS_CONFIG_ACTIVATED"
  | "STATUS_CONFIG_DEACTIVATED"
  | "STATUS_CONFIG_DELETED"
  | "SECURITY_POLICY_VIOLATION";

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
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
  actorEmail?: string;
  targetEmail?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}
