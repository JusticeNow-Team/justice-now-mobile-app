export type AssignmentStatus =
  | "assigned"
  | "under_review"
  | "completed"
  | "cancelled";

export type EvidenceDecision =
  | "approved"
  | "rejected"
  | "replacement_requested"
  | "escalated";

export type EvidencePriority = "low" | "medium" | "high" | "urgent";

export type ValidatorEvidenceItem = {
  assignmentId: string;
  assignmentStatus: AssignmentStatus;
  assignedAt: string;
  startedAt: string | null;
  evidenceId: string;
  evidenceType: string;
  evidenceTitle: string;
  evidenceDescription: string | null;
  evidenceCreatedAt: string;
  fileName: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  validationStatus: string;
  caseId: string;
  caseReference: string;
  caseTitle: string;
  caseCategory: string;
  caseIncidentDate: string | null;
  casePriority: EvidencePriority;
  isAnonymous: boolean;
  assignedByName: string;
};

export type VerificationHistoryItem = {
  decisionId: string;
  assignmentId: string;
  evidenceId: string;
  evidenceTitle: string;
  fileName: string | null;
  caseId: string;
  caseReference: string;
  decision: EvidenceDecision;
  reason: string;
  internalNotes: string | null;
  reporterMessage: string | null;
  decidedAt: string;
};

export type SubmitEvidenceDecisionInput = {
  assignmentId: string;
  decision: EvidenceDecision;
  reason: string;
  internalNotes: string;
  reporterMessage: string;
};

export type ValidatorDashboardData = {
  validatorName: string;
  queue: ValidatorEvidenceItem[];
  history: VerificationHistoryItem[];
};