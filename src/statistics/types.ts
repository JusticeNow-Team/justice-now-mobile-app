import { SystemRole } from "../auth/types";
import { CaseWorkflowStatus, EvidenceWorkflowStatus } from "../workflow/types";

export type DateRangeFilter = "all" | "today" | "7d" | "30d" | "90d";

export interface StatisticsFilterOptions {
  dateRange?: DateRangeFilter;
  category?: string;
  role?: SystemRole | "all";
}

export interface RoleDistributionItem {
  role: SystemRole;
  label: string;
  count: number;
  activeCount: number;
  inactiveCount: number;
  percentage: number;
  icon: string;
  tone: "royal" | "warning" | "success" | "info" | "danger" | "neutral";
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  reportersCount: number;
  caseOfficersCount: number;
  evidenceCheckersCount: number;
  systemAdminsCount: number;
  rolesBreakdown: RoleDistributionItem[];
}

export interface CaseStatusDistributionItem {
  status: CaseWorkflowStatus;
  label: string;
  count: number;
  percentage: number;
  isActiveStage: boolean;
  tone: "info" | "warning" | "success" | "danger" | "neutral";
}

export interface CategoryDistributionItem {
  category: string;
  code?: string;
  icon?: string;
  count: number;
  activeCount: number;
  percentage: number;
}

export interface CaseStatistics {
  totalCases: number;
  activeCases: number;
  resolvedCases: number;
  awaitingReviewCases: number;
  investigatingCases: number;
  statusBreakdown: CaseStatusDistributionItem[];
  categoryBreakdown: CategoryDistributionItem[];
}

export interface EvidenceStatusDistributionItem {
  status: EvidenceWorkflowStatus;
  label: string;
  count: number;
  percentage: number;
  tone: "info" | "warning" | "success" | "danger" | "neutral";
}

export interface EvidenceStatistics {
  totalEvidence: number;
  awaitingVerification: number;
  completedVerification: number;
  verificationRatePercentage: number;
  statusBreakdown: EvidenceStatusDistributionItem[];
}

export interface WorkloadMetrics {
  avgCasesPerOfficer: number;
  avgEvidencePerChecker: number;
  activeOfficersCount: number;
  activeCheckersCount: number;
}

export interface SystemStatistics {
  userStats: UserStatistics;
  caseStats: CaseStatistics;
  evidenceStats: EvidenceStatistics;
  workload: WorkloadMetrics;
  filterMeta: {
    dateRange: DateRangeFilter;
    category?: string;
    appliedAt: string;
  };
  computedAt: string;
  dataSource: "live" | "fallback";
}
