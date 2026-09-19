export type CaseWorkflowStatus =
  | "submitted"
  | "under_review"
  | "investigating"
  | "awaiting_information"
  | "action_taken"
  | "resolved"
  | "dismissed"
  | "withdrawn"
  | "closed";

export type EvidenceWorkflowStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "validated"
  | "rejected"
  | "reassignment_requested"
  | "escalated"
  | "info_requested"
  | "archived";

export interface WorkflowCaseItem {
  id: string;
  caseReference: string;
  title: string;
  status: CaseWorkflowStatus;
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  submittedAt: string;
  lastUpdatedAt: string;
  evidenceCount: number;
}

export interface WorkflowEvidenceItem {
  id: string;
  caseId: string;
  caseReference: string;
  fileName: string;
  fileType: string;
  status: EvidenceWorkflowStatus;
  assignedCheckerId?: string;
  assignedCheckerName?: string;
  uploadedAt: string;
  lastUpdatedAt: string;
}

export interface CaseStatusBreakdown {
  status: CaseWorkflowStatus;
  label: string;
  count: number;
  percentage: number;
  tone: "info" | "warning" | "success" | "neutral" | "danger";
  isActiveWorkflow: boolean;
}

export interface EvidenceStatusBreakdown {
  status: EvidenceWorkflowStatus;
  label: string;
  count: number;
  percentage: number;
  tone: "info" | "warning" | "success" | "neutral" | "danger";
  isAwaitingVerification: boolean;
  isCompleted: boolean;
}

export interface WorkflowDelayItem {
  id: string;
  itemType: "case" | "evidence";
  reference: string;
  title: string;
  status: string;
  durationHours: number;
  severity: "warning" | "critical";
  assignedTo?: string;
  createdAt: string;
}

export interface WorkflowDashboardMetrics {
  // AC 1: Total active cases (non-terminal states)
  totalActiveCases: number;

  // AC 2: Cases awaiting initial review (submitted, under_review)
  casesAwaitingInitialReview: number;

  // AC 3: Evidence awaiting verification (pending, under_review)
  evidenceAwaitingVerification: number;

  // AC 4: Completed verification count (approved, validated, rejected)
  completedVerificationCount: number;

  // Additional holistic workflow metrics
  totalCasesCount: number;
  totalEvidenceCount: number;
  resolvedCasesCount: number;
  delayedCasesCount: number;
  delayedEvidenceCount: number;
  activeOfficersCount: number;
  activeCheckersCount: number;

  // Status Breakdowns (JN-290)
  caseStatusBreakdown: CaseStatusBreakdown[];
  evidenceStatusBreakdown: EvidenceStatusBreakdown[];

  // Delay / Bottleneck alerts
  delayAlerts: WorkflowDelayItem[];

  // Calculation metadata (AC 5)
  computedAt: string;
  dataSource: "live" | "fallback";
}

export interface WorkflowFilterOptions {
  category?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  includeTerminal?: boolean;
}
