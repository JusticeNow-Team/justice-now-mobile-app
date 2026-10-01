import { SystemRole } from "../auth/types";

export type SecurityDomainId =
  | "protected_routes"
  | "role_authorization"
  | "ownership_isolation"
  | "evidence_access"
  | "inactive_accounts"
  | "secrets_hygiene";

export type SecurityStatus = "PASS" | "FAIL" | "WARN";

export interface SecurityCheckItem {
  id: string;
  domain: SecurityDomainId;
  name: string;
  description: string;
  status: SecurityStatus;
  details: string;
  testedEntitiesCount?: number;
  acceptanceCriteriaRef: string;
  subtaskRef: string;
}

export interface SecurityDomainSummary {
  domainId: SecurityDomainId;
  title: string;
  subtitle: string;
  status: SecurityStatus;
  scorePercentage: number;
  checksTotal: number;
  checksPassed: number;
  checks: SecurityCheckItem[];
}

export interface SecurityDefectRecord {
  defectId: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
  mitigation: string;
  resolutionStatus: "RESOLVED" | "VERIFIED" | "OPEN";
  verifiedDate: string;
  subtaskRef: string;
}

export interface SecurityReviewSummary {
  overallStatus: SecurityStatus;
  complianceScore: number; // 0 - 100
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalDefectsOpen: number;
  evaluatedAt: string;
  evaluatedBy: string;
  domains: SecurityDomainSummary[];
  defectLog: SecurityDefectRecord[];
}

export interface ProtectedRouteDefinition {
  route: string;
  portal: "admin" | "officer" | "checker" | "validator" | "reporter";
  requiredRoles: SystemRole[];
  authRequired: boolean;
  guardComponent: string;
  description: string;
}

export const CANONICAL_PROTECTED_ROUTES: ProtectedRouteDefinition[] = [
  {
    route: "/admin",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "System Admin Dashboard Overview Hub",
  },
  {
    route: "/admin/staff",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Staff & User Account Management Roster",
  },
  {
    route: "/admin/audit",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Administrative Tamper-Evident Audit Logs",
  },
  {
    route: "/admin/workflow",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Workflow Activity & Intake Pipeline Monitoring",
  },
  {
    route: "/admin/categories",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Case Category Classification Management",
  },
  {
    route: "/admin/statistics",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "System Statistics & Workload Dashboard",
  },
  {
    route: "/admin/settings",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Account Activation & System Configuration Settings",
  },
  {
    route: "/admin/security",
    portal: "admin",
    requiredRoles: ["system_admin"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Security Posture & Final Access Review Dashboard",
  },
  {
    route: "/officer",
    portal: "officer",
    requiredRoles: ["case_officer"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Case Officer Investigation & Queue Portal",
  },
  {
    route: "/checker",
    portal: "checker",
    requiredRoles: ["evidence_checker"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Evidence Verification Queue & Review Workspace",
  },
  {
    route: "/validator",
    portal: "validator",
    requiredRoles: ["evidence_checker"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Forensic Evidence Validator Workspace",
  },
  {
    route: "/reporter",
    portal: "reporter",
    requiredRoles: ["reporter"],
    authRequired: true,
    guardComponent: "RoleGuard",
    description: "Reporter Personal Incident Tracking Portal",
  },
];

export const RESOLVED_SECURITY_DEFECTS: SecurityDefectRecord[] = [
  {
    defectId: "SEC-DEF-001",
    title: "Unauthenticated Route Bypass Prevention",
    severity: "CRITICAL",
    category: "Authentication",
    description: "Unauthenticated users could attempt direct URL navigation to protected staff routes without valid session cookies.",
    mitigation: "Enforced centralized RoleGuard and PermissionGuard on all sub-routes, redirecting unauthenticated sessions to /secure-role with local state cleansing.",
    resolutionStatus: "VERIFIED",
    verifiedDate: "2026-10-01",
    subtaskRef: "JN-400",
  },
  {
    defectId: "SEC-DEF-002",
    title: "Cross-Reporter Incident Data Leakage (IDOR)",
    severity: "CRITICAL",
    category: "Authorization & Ownership",
    description: "Potential Insecure Direct Object Reference if a Reporter queries case IDs belonging to another citizen reporter.",
    mitigation: "Implemented strict database RLS policies and server-side filter validation (caseRow.reporter_id === user.id), rejecting foreign case lookups with 403 Forbidden.",
    resolutionStatus: "VERIFIED",
    verifiedDate: "2026-10-01",
    subtaskRef: "JN-402",
  },
  {
    defectId: "SEC-DEF-003",
    title: "Public Storage Object Exposure Prevention",
    severity: "HIGH",
    category: "Data Privacy & Storage",
    description: "Evidence media could be accessed anonymously if public bucket read policies were improperly configured.",
    mitigation: "Strictly set all evidence storage buckets to private RLS mode; all media retrieval uses time-limited HMAC-signed URLs via createSignedUrl with automatic expiration.",
    resolutionStatus: "VERIFIED",
    verifiedDate: "2026-10-01",
    subtaskRef: "JN-403",
  },
  {
    defectId: "SEC-DEF-004",
    title: "Inactive / Suspended User Session Invalidation",
    severity: "HIGH",
    category: "Access Control",
    description: "Deactivated or suspended staff members might retain active cached tokens until expiration.",
    mitigation: "AuthContext and settingsService validate is_active and status on every initialization and profile refresh, calling supabase.auth.signOut and clearing storage on inactive detection.",
    resolutionStatus: "VERIFIED",
    verifiedDate: "2026-10-01",
    subtaskRef: "JN-404",
  },
  {
    defectId: "SEC-DEF-005",
    title: "Repository Secret Exposure & Audit Credential Sanitization",
    severity: "HIGH",
    category: "Secret Hygiene",
    description: "Risk of committing private service role keys or sensitive parameters (passwords, tokens, OTPs) to GitHub.",
    mitigation: "Configured comprehensive .gitignore rules for all .env files and private keys; sanitized .env.example with zero secret values; enforced recursive sanitizeAuditDetails redaction.",
    resolutionStatus: "VERIFIED",
    verifiedDate: "2026-10-01",
    subtaskRef: "JN-404",
  },
  {
    defectId: "SEC-DEF-006",
    title: "Role Escalation & Module Cross-Boundary Contamination",
    severity: "MEDIUM",
    category: "RBAC",
    description: "Non-admin roles (Case Officer, Evidence Checker) attempting administrative operations or Case Officer status transitions by Evidence Checkers.",
    mitigation: "Implemented MODULE_PERMISSION_MATRIX, assertAdminOperationAllowed, and assertCaseManagementUpdateAllowed, strictly isolating operational capabilities.",
    resolutionStatus: "VERIFIED",
    verifiedDate: "2026-10-01",
    subtaskRef: "JN-401",
  },
];
