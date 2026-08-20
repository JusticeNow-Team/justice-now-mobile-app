export type EvidenceChecker = {
  id: string;
  fullName: string;
  activeAssignmentCount: number;
};

export type EvidenceAssignmentSummary = {
  assignmentId: string;
  evidenceId: string;
  checkerId: string;
  checkerName: string;
  status: "assigned" | "under_review" | "completed" | "cancelled";
  assignedAt: string;
};

export type AssignedEvidenceItem = {
  assignmentId: string;
  assignmentStatus: "assigned" | "under_review";
  assignedAt: string;
  evidenceId: string;
  evidenceType: string;
  evidenceTitle: string;
  evidenceDescription: string | null;
  fileName: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  validationStatus: string;
  caseId: string;
  caseReference: string;
  caseTitle: string;
  assignedByName: string;
};

export type AssignEvidenceResult =
  | {
      ok: true;
      assignment: EvidenceAssignmentSummary;
    }
  | {
      ok: false;
      message: string;
    };
