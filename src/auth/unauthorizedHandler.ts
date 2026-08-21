import { SystemRole } from "./types";

export interface SecurityIncidentLog {
  id: string;
  actorRole: SystemRole | "anonymous";
  attemptedPathOrAction: string;
  reason: string;
  statusCode: number;
  timestamp: string;
}

const inMemorySecurityLogs: SecurityIncidentLog[] = [];

/**
 * Formats a user-friendly error message based on the violation reason code.
 */
export function formatUnauthorizedReason(reasonCode?: string): {
  title: string;
  message: string;
} {
  switch (reasonCode) {
    case "reporter_staff_access":
      return {
        title: "Staff Area Restricted",
        message:
          "Public Reporter accounts cannot access internal staff workspaces. Please sign in with an authorized staff account.",
      };
    case "officer_admin_access":
      return {
        title: "Administrator Access Required",
        message:
          "Case Officers are restricted from accessing System Administration and security configuration operations.",
      };
    case "checker_case_management":
      return {
        title: "Case Management Restricted",
        message:
          "Evidence Checkers are restricted from modifying case classifications, case assignments, or case status fields.",
      };
    case "inactive":
      return {
        title: "Account Inactive",
        message:
          "Your account or assigned role is currently inactive. Please contact your system administrator to reactivate your credentials.",
      };
    default:
      return {
        title: "Access Restricted",
        message:
          "You do not have authorization to view this section or execute this action. JusticeNow enforces strict module-level access controls.",
      };
  }
}

/**
 * Records a security violation incident log (JN-248).
 */
export function logSecurityIncident(params: {
  actorRole?: SystemRole | null;
  attemptedPathOrAction: string;
  reason: string;
  statusCode?: number;
}): SecurityIncidentLog {
  const incident: SecurityIncidentLog = {
    id: `sec_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    actorRole: params.actorRole || "anonymous",
    attemptedPathOrAction: params.attemptedPathOrAction,
    reason: params.reason,
    statusCode: params.statusCode || 403,
    timestamp: new Date().toISOString(),
  };

  inMemorySecurityLogs.unshift(incident);
  return incident;
}

/**
 * Returns recorded security incident logs.
 */
export function getSecurityIncidentLogs(): SecurityIncidentLog[] {
  return [...inMemorySecurityLogs];
}
