import { AuthorizationError } from "../auth/middleware";
import { normalizeRole } from "../auth/roles";
import { SystemRole } from "../auth/types";
import { supabase } from "../lib/supabase";
import {
  CaseWorkflowStatus,
  EvidenceWorkflowStatus,
  WorkflowCaseItem,
  WorkflowEvidenceItem,
} from "../workflow/types";
import {
  INITIAL_MOCK_CASES,
  INITIAL_MOCK_EVIDENCE,
  INITIAL_MOCK_USERS,
  MockUserRecord,
} from "./seeds/statisticsSeed";
import {
  CaseStatistics,
  CaseStatusDistributionItem,
  CategoryDistributionItem,
  DateRangeFilter,
  EvidenceStatistics,
  EvidenceStatusDistributionItem,
  RoleDistributionItem,
  StatisticsFilterOptions,
  SystemStatistics,
  UserStatistics,
  WorkloadMetrics,
} from "./types";

// In-memory runtime/test stores
let inMemoryUsers: MockUserRecord[] = [...INITIAL_MOCK_USERS.map((u) => ({ ...u }))];
let inMemoryCases: WorkflowCaseItem[] = [...INITIAL_MOCK_CASES.map((c) => ({ ...c }))];
let inMemoryEvidence: WorkflowEvidenceItem[] = [
  ...INITIAL_MOCK_EVIDENCE.map((e) => ({ ...e })),
];

// ============================================================================
// SECURITY & ROLE GUARD (AC 7)
// ============================================================================

export function requireAdministrator(actorRole?: string): void {
  const normalized = normalizeRole(actorRole);
  if (normalized !== "system_admin") {
    throw new AuthorizationError(
      `Unauthorized: System Statistics Dashboard is strictly restricted to System Administrators. Current role: ${actorRole ?? "anonymous"}`,
      "UNAUTHORIZED_STATISTICS_ACCESS",
      403,
    );
  }
}

// ============================================================================
// DATE FILTERING HELPERS (JN-390, AC 6)
// ============================================================================

function filterByDateRange<T extends { createdAt?: string; submittedAt?: string; uploadedAt?: string }>(
  items: T[],
  range: DateRangeFilter,
  nowTimestamp = Date.now(),
): T[] {
  if (!range || range === "all") return items;

  const msInHour = 60 * 60 * 1000;
  const msInDay = 24 * msInHour;

  let cutoffTime = 0;
  if (range === "today") {
    cutoffTime = nowTimestamp - 24 * msInHour;
  } else if (range === "7d") {
    cutoffTime = nowTimestamp - 7 * msInDay;
  } else if (range === "30d") {
    cutoffTime = nowTimestamp - 30 * msInDay;
  } else if (range === "90d") {
    cutoffTime = nowTimestamp - 90 * msInDay;
  }

  return items.filter((item) => {
    const rawDate = item.createdAt || item.submittedAt || item.uploadedAt;
    if (!rawDate) return true;
    const itemTime = new Date(rawDate).getTime();
    if (Number.isNaN(itemTime)) return true;
    return itemTime >= cutoffTime;
  });
}

// ============================================================================
// USER STATISTICS AGGREGATION (AC 1 & AC 2)
// ============================================================================

const ROLE_METADATA: Record<
  SystemRole,
  { label: string; icon: string; tone: RoleDistributionItem["tone"] }
> = {
  reporter: {
    label: "Citizen Reporters",
    icon: "user",
    tone: "royal",
  },
  case_officer: {
    label: "Case Investigators",
    icon: "shield",
    tone: "info",
  },
  evidence_checker: {
    label: "Evidence Checkers",
    icon: "file-search",
    tone: "warning",
  },
  system_admin: {
    label: "System Administrators",
    icon: "balance",
    tone: "royal",
  },
};

export function calculateUserStatistics(users: MockUserRecord[]): UserStatistics {
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;

  const roles: SystemRole[] = [
    "reporter",
    "case_officer",
    "evidence_checker",
    "system_admin",
  ];

  const rolesBreakdown: RoleDistributionItem[] = roles.map((role) => {
    const roleUsers = users.filter((u) => u.role === role);
    const count = roleUsers.length;
    const activeCount = roleUsers.filter((u) => u.isActive).length;
    const inactiveCount = count - activeCount;
    const percentage = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
    const meta = ROLE_METADATA[role];

    return {
      role,
      label: meta.label,
      count,
      activeCount,
      inactiveCount,
      percentage,
      icon: meta.icon,
      tone: meta.tone,
    };
  });

  const reportersCount = users.filter((u) => u.role === "reporter").length;
  const caseOfficersCount = users.filter((u) => u.role === "case_officer").length;
  const evidenceCheckersCount = users.filter((u) => u.role === "evidence_checker").length;
  const systemAdminsCount = users.filter((u) => u.role === "system_admin").length;

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    reportersCount,
    caseOfficersCount,
    evidenceCheckersCount,
    systemAdminsCount,
    rolesBreakdown,
  };
}

// ============================================================================
// CASE STATISTICS AGGREGATION (AC 3 & AC 4)
// ============================================================================

const CASE_STATUS_ORDER: {
  status: CaseWorkflowStatus;
  label: string;
  isActiveStage: boolean;
  tone: CaseStatusDistributionItem["tone"];
}[] = [
  { status: "submitted", label: "Submitted", isActiveStage: true, tone: "info" },
  { status: "under_review", label: "Under Review", isActiveStage: true, tone: "warning" },
  { status: "investigating", label: "Investigating", isActiveStage: true, tone: "info" },
  { status: "awaiting_information", label: "Awaiting Info", isActiveStage: true, tone: "warning" },
  { status: "action_taken", label: "Action Taken", isActiveStage: true, tone: "info" },
  { status: "resolved", label: "Resolved", isActiveStage: false, tone: "success" },
  { status: "dismissed", label: "Dismissed", isActiveStage: false, tone: "neutral" },
  { status: "withdrawn", label: "Withdrawn", isActiveStage: false, tone: "danger" },
];

export function calculateCaseStatistics(cases: WorkflowCaseItem[]): CaseStatistics {
  const totalCases = cases.length;
  const activeCases = cases.filter(
    (c) => !["resolved", "dismissed", "withdrawn", "closed"].includes(c.status),
  ).length;
  const resolvedCases = cases.filter((c) => c.status === "resolved").length;
  const awaitingReviewCases = cases.filter(
    (c) => c.status === "submitted" || c.status === "under_review",
  ).length;
  const investigatingCases = cases.filter((c) => c.status === "investigating").length;

  // Status breakdown
  const statusBreakdown: CaseStatusDistributionItem[] = CASE_STATUS_ORDER.map((item) => {
    const count = cases.filter((c) => c.status === item.status).length;
    const percentage = totalCases > 0 ? Math.round((count / totalCases) * 100) : 0;
    return {
      status: item.status,
      label: item.label,
      count,
      percentage,
      isActiveStage: item.isActiveStage,
      tone: item.tone,
    };
  });

  // Category breakdown
  const categoryMap = new Map<string, { total: number; active: number }>();
  for (const c of cases) {
    const cat = c.category || "General Incident";
    const existing = categoryMap.get(cat) || { total: 0, active: 0 };
    existing.total += 1;
    if (!["resolved", "dismissed", "withdrawn", "closed"].includes(c.status)) {
      existing.active += 1;
    }
    categoryMap.set(cat, existing);
  }

  const categoryBreakdown: CategoryDistributionItem[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      count: stats.total,
      activeCount: stats.active,
      percentage: totalCases > 0 ? Math.round((stats.total / totalCases) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCases,
    activeCases,
    resolvedCases,
    awaitingReviewCases,
    investigatingCases,
    statusBreakdown,
    categoryBreakdown,
  };
}

// ============================================================================
// EVIDENCE STATISTICS AGGREGATION (AC 5)
// ============================================================================

const EVIDENCE_STATUS_ORDER: {
  status: EvidenceWorkflowStatus;
  label: string;
  tone: EvidenceStatusDistributionItem["tone"];
}[] = [
  { status: "pending", label: "Pending Verification", tone: "warning" },
  { status: "under_review", label: "Under Analysis", tone: "info" },
  { status: "approved", label: "Approved", tone: "success" },
  { status: "validated", label: "Validated", tone: "success" },
  { status: "rejected", label: "Rejected", tone: "danger" },
  { status: "info_requested", label: "Info Requested", tone: "warning" },
  { status: "escalated", label: "Escalated", tone: "danger" },
  { status: "reassignment_requested", label: "Reassignment Req.", tone: "neutral" },
];

export function calculateEvidenceStatistics(evidence: WorkflowEvidenceItem[]): EvidenceStatistics {
  const totalEvidence = evidence.length;
  const awaitingVerification = evidence.filter(
    (e) => e.status === "pending" || e.status === "under_review",
  ).length;
  const completedVerification = evidence.filter(
    (e) => e.status === "approved" || e.status === "validated" || e.status === "rejected",
  ).length;
  const verificationRatePercentage =
    totalEvidence > 0 ? Math.round((completedVerification / totalEvidence) * 100) : 0;

  const statusBreakdown: EvidenceStatusDistributionItem[] = EVIDENCE_STATUS_ORDER.map((item) => {
    const count = evidence.filter((e) => e.status === item.status).length;
    const percentage = totalEvidence > 0 ? Math.round((count / totalEvidence) * 100) : 0;
    return {
      status: item.status,
      label: item.label,
      count,
      percentage,
      tone: item.tone,
    };
  });

  return {
    totalEvidence,
    awaitingVerification,
    completedVerification,
    verificationRatePercentage,
    statusBreakdown,
  };
}

// ============================================================================
// WORKLOAD METRICS CALCULATION (JN-389)
// ============================================================================

export function calculateWorkloadMetrics(
  users: MockUserRecord[],
  cases: WorkflowCaseItem[],
  evidence: WorkflowEvidenceItem[],
): WorkloadMetrics {
  const activeOfficers = users.filter((u) => u.role === "case_officer" && u.isActive).length;
  const activeCheckers = users.filter((u) => u.role === "evidence_checker" && u.isActive).length;

  const activeCasesCount = cases.filter(
    (c) => !["resolved", "dismissed", "withdrawn", "closed"].includes(c.status),
  ).length;
  const pendingEvidenceCount = evidence.filter(
    (e) => e.status === "pending" || e.status === "under_review",
  ).length;

  const avgCasesPerOfficer =
    activeOfficers > 0 ? Math.round((activeCasesCount / activeOfficers) * 10) / 10 : 0;
  const avgEvidencePerChecker =
    activeCheckers > 0 ? Math.round((pendingEvidenceCount / activeCheckers) * 10) / 10 : 0;

  return {
    avgCasesPerOfficer,
    avgEvidencePerChecker,
    activeOfficersCount: activeOfficers,
    activeCheckersCount: activeCheckers,
  };
}

// ============================================================================
// MAIN STATISTICS QUERY ENGINE (JN-387, AC 1 - 7)
// ============================================================================

export async function getSystemStatistics(
  filters: StatisticsFilterOptions = {},
  actorRole = "system_admin",
): Promise<SystemStatistics> {
  // AC 7: Admin RBAC check
  requireAdministrator(actorRole);

  let rawUsers: MockUserRecord[] = [];
  let rawCases: WorkflowCaseItem[] = [];
  let rawEvidence: WorkflowEvidenceItem[] = [];
  let dataSource: "live" | "fallback" = "fallback";

  try {
    const [profilesRes, casesRes, evidenceRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, department, created_at"),
      supabase
        .from("cases")
        .select("id, case_reference, title, status, priority, category, created_at, updated_at"),
      supabase
        .from("case_evidence")
        .select("id, case_id, file_name, file_type, validation_status, created_at, updated_at"),
    ]);

    if (!profilesRes.error && !casesRes.error && !evidenceRes.error && profilesRes.data && casesRes.data && evidenceRes.data) {
      dataSource = "live";
      rawUsers = profilesRes.data.map((row: any) => ({
        id: row.id,
        email: row.email || "",
        fullName: row.full_name || "User",
        role: (normalizeRole(row.role) || "reporter") as SystemRole,
        isActive: row.is_active !== false,
        department: row.department,
        createdAt: row.created_at || new Date().toISOString(),
      }));

      rawCases = casesRes.data.map((row: any) => ({
        id: row.id,
        caseReference: row.case_reference || `JN-${row.id.slice(0, 8)}`,
        title: row.title || "Untitled Incident",
        status: (row.status || "submitted") as CaseWorkflowStatus,
        priority: (row.priority || "medium") as any,
        category: row.category || "General Incident",
        submittedAt: row.created_at || new Date().toISOString(),
        lastUpdatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        evidenceCount: 0,
      }));

      rawEvidence = evidenceRes.data.map((row: any) => ({
        id: row.id,
        caseId: row.case_id,
        caseReference: `CASE-${row.case_id?.slice(0, 8) || "REF"}`,
        fileName: row.file_name || "evidence_file.bin",
        fileType: row.file_type || "application/octet-stream",
        status: (row.validation_status || "pending") as EvidenceWorkflowStatus,
        uploadedAt: row.created_at || new Date().toISOString(),
        lastUpdatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      }));
    } else {
      rawUsers = [...inMemoryUsers];
      rawCases = [...inMemoryCases];
      rawEvidence = [...inMemoryEvidence];
    }
  } catch {
    rawUsers = [...inMemoryUsers];
    rawCases = [...inMemoryCases];
    rawEvidence = [...inMemoryEvidence];
  }

  // Apply filters (JN-390, AC 6)
  const dateRange = filters.dateRange || "all";
  let filteredUsers = filterByDateRange(rawUsers, dateRange);
  let filteredCases = filterByDateRange(rawCases, dateRange);
  let filteredEvidence = filterByDateRange(rawEvidence, dateRange);

  if (filters.category && filters.category !== "all") {
    const targetCat = filters.category.toLowerCase().trim();
    filteredCases = filteredCases.filter((c) =>
      c.category.toLowerCase().includes(targetCat),
    );
  }

  if (filters.role && filters.role !== "all") {
    filteredUsers = filteredUsers.filter((u) => u.role === filters.role);
  }

  const userStats = calculateUserStatistics(filteredUsers);
  const caseStats = calculateCaseStatistics(filteredCases);
  const evidenceStats = calculateEvidenceStatistics(filteredEvidence);
  const workload = calculateWorkloadMetrics(filteredUsers, filteredCases, filteredEvidence);

  return {
    userStats,
    caseStats,
    evidenceStats,
    workload,
    filterMeta: {
      dateRange,
      category: filters.category,
      appliedAt: new Date().toISOString(),
    },
    computedAt: new Date().toISOString(),
    dataSource,
  };
}

// ============================================================================
// TEST & RUNTIME RE-INITIALIZATION
// ============================================================================

export function resetStatisticsStoreForTesting(
  overrideUsers?: MockUserRecord[],
  overrideCases?: WorkflowCaseItem[],
  overrideEvidence?: WorkflowEvidenceItem[],
): void {
  inMemoryUsers = overrideUsers
    ? overrideUsers.map((u) => ({ ...u }))
    : [...INITIAL_MOCK_USERS.map((u) => ({ ...u }))];
  inMemoryCases = overrideCases
    ? overrideCases.map((c) => ({ ...c }))
    : [...INITIAL_MOCK_CASES.map((c) => ({ ...c }))];
  inMemoryEvidence = overrideEvidence
    ? overrideEvidence.map((e) => ({ ...e }))
    : [...INITIAL_MOCK_EVIDENCE.map((e) => ({ ...e }))];
}

export function setEmptyStatisticsStoreForTesting(): void {
  inMemoryUsers = [];
  inMemoryCases = [];
  inMemoryEvidence = [];
}
