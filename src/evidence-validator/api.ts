import { supabase } from "../lib/supabase";
import {
    AssignmentStatus,
    EvidenceDecision,
    EvidencePriority,
    SubmitEvidenceDecisionInput,
    ValidatorDashboardData,
    ValidatorEvidenceItem,
    VerificationHistoryItem,
} from "./types";

type EvidenceRow = {
  assignment_id: string;
  assignment_status: AssignmentStatus;
  assigned_at: string;
  started_at: string | null;
  evidence_id: string;
  evidence_type: string;
  evidence_title: string;
  evidence_description: string | null;
  evidence_created_at: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | string | null;
  validation_status: string;
  case_id: string;
  case_reference: string;
  case_title: string;
  case_category: string;
  case_incident_date: string | null;
  case_priority: EvidencePriority;
  is_anonymous: boolean;
  assigned_by_name: string;
};

type HistoryRow = {
  decision_id: string;
  assignment_id: string;
  evidence_id: string;
  evidence_title: string;
  file_name: string | null;
  case_id: string;
  case_reference: string;
  decision: EvidenceDecision;
  reason: string;
  internal_notes: string | null;
  reporter_message: string | null;
  decided_at: string;
};

function mapEvidence(row: EvidenceRow): ValidatorEvidenceItem {
  return {
    assignmentId: row.assignment_id,
    assignmentStatus: row.assignment_status,
    assignedAt: row.assigned_at,
    startedAt: row.started_at,
    evidenceId: row.evidence_id,
    evidenceType: row.evidence_type,
    evidenceTitle: row.evidence_title,
    evidenceDescription: row.evidence_description,
    evidenceCreatedAt: row.evidence_created_at,
    fileName: row.file_name,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes:
      row.file_size_bytes === null ? null : Number(row.file_size_bytes),
    validationStatus: row.validation_status,
    caseId: row.case_id,
    caseReference: row.case_reference,
    caseTitle: row.case_title,
    caseCategory: row.case_category,
    caseIncidentDate: row.case_incident_date,
    casePriority: row.case_priority,
    isAnonymous: row.is_anonymous,
    assignedByName: row.assigned_by_name,
  };
}

function mapHistory(row: HistoryRow): VerificationHistoryItem {
  return {
    decisionId: row.decision_id,
    assignmentId: row.assignment_id,
    evidenceId: row.evidence_id,
    evidenceTitle: row.evidence_title,
    fileName: row.file_name,
    caseId: row.case_id,
    caseReference: row.case_reference,
    decision: row.decision,
    reason: row.reason,
    internalNotes: row.internal_notes,
    reporterMessage: row.reporter_message,
    decidedAt: row.decided_at,
  };
}

export async function getCurrentValidatorName() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Your staff session is no longer available.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data?.full_name?.trim() || "Evidence Validator";
}

export async function getMyAssignedEvidence() {
  const { data, error } = await supabase.rpc("get_my_evidence_assignments");

  if (error) {
    throw error;
  }

  return ((data ?? []) as EvidenceRow[]).map(mapEvidence);
}

export async function getEvidenceAssignmentDetail(assignmentId: string) {
  const { data, error } = await supabase.rpc(
    "get_my_evidence_assignment_detail",
    {
      p_assignment_id: assignmentId,
    },
  );

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as EvidenceRow | null;

  if (!row) {
    throw new Error("This evidence assignment could not be found.");
  }

  return mapEvidence(row);
}

export async function startEvidenceReview(assignmentId: string) {
  const { error } = await supabase.rpc("start_my_evidence_review", {
    p_assignment_id: assignmentId,
  });

  if (error) {
    throw error;
  }
}

export async function createEvidenceSignedUrl(
  item: Pick<ValidatorEvidenceItem, "storageBucket" | "storagePath">,
  expiresInSeconds = 60,
) {
  if (!item.storageBucket || !item.storagePath) {
    throw new Error("This evidence record does not have a digital file.");
  }

  const { data, error } = await supabase.storage
    .from(item.storageBucket)
    .createSignedUrl(item.storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || "A secure evidence link could not be generated.",
    );
  }

  return data.signedUrl;
}

export async function submitEvidenceDecision(
  input: SubmitEvidenceDecisionInput,
) {
  const { data, error } = await supabase.rpc(
    "submit_evidence_verification_decision",
    {
      p_assignment_id: input.assignmentId,
      p_decision: input.decision,
      p_reason: input.reason.trim(),
      p_internal_notes: input.internalNotes.trim() || null,
      p_reporter_message: input.reporterMessage.trim() || null,
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function getMyVerificationHistory() {
  const { data, error } = await supabase.rpc(
    "get_my_evidence_verification_history",
  );

  if (error) {
    // Verification decisions are delivered in a later Sprint 3 story. Keep the
    // JN-340 assignment queue usable until that RPC is deployed.
    if (error.code === "PGRST202" || error.code === "42883") {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as HistoryRow[]).map(mapHistory);
}

export async function getValidatorDashboard(): Promise<ValidatorDashboardData> {
  const [validatorName, queue, history] = await Promise.all([
    getCurrentValidatorName(),
    getMyAssignedEvidence(),
    getMyVerificationHistory(),
  ]);

  return {
    validatorName,
    queue,
    history,
  };
}
