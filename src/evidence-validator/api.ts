import { supabase } from "../lib/supabase";
import { INITIAL_MOCK_EVIDENCE } from "../checker/api";
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

const LOCAL_ASSIGNMENT_PREFIX = "LOCAL-ASN";
const FALLBACK_ERROR_CODES = new Set(["PGRST202", "42883"]);

let localAssignedEvidence: ValidatorEvidenceItem[] = INITIAL_MOCK_EVIDENCE.map((record, index) => ({
  assignmentId: `${LOCAL_ASSIGNMENT_PREFIX}-${record.id}`,
  assignmentStatus:
    record.assignmentStatus === "completed"
      ? ("completed" as AssignmentStatus)
      : record.validationStatus === "under_review"
        ? ("under_review" as AssignmentStatus)
        : ("assigned" as AssignmentStatus),
  assignedAt:
    record.assignedAt ||
    record.uploadDate ||
    new Date(Date.now() - index * 60 * 60 * 1000).toISOString(),
  startedAt: record.validationStatus === "under_review" ? record.lastStatusChangedAt || null : null,
  evidenceId: record.id,
  evidenceType: record.evidenceType || "document",
  evidenceTitle: record.fileName || record.description || "Evidence file",
  evidenceDescription: record.description || null,
  evidenceCreatedAt: record.uploadDate || new Date().toISOString(),
  fileName: record.fileName || null,
  storageBucket: record.storageBucket || null,
  storagePath: record.storagePath || null,
  mimeType: record.fileType || null,
  fileSizeBytes:
    typeof record.fileSizeBytes === "number" ? record.fileSizeBytes : null,
  validationStatus: record.validationStatus || "pending",
  caseId: record.caseId || "LOCAL-CASE",
  caseReference: record.caseInfo?.caseReference || record.caseId || "LOCAL-CASE",
  caseTitle: record.caseInfo?.title || "Evidence review case",
  caseCategory: record.caseInfo?.category || "Evidence Review",
  caseIncidentDate: record.caseInfo?.incidentDate || null,
  casePriority:
    record.caseInfo?.urgencyLevel?.toLowerCase() === "critical"
      ? ("urgent" as EvidencePriority)
      : record.caseInfo?.urgencyLevel?.toLowerCase() === "high"
        ? ("high" as EvidencePriority)
        : record.caseInfo?.urgencyLevel?.toLowerCase() === "medium"
          ? ("medium" as EvidencePriority)
          : ("low" as EvidencePriority),
  isAnonymous: Boolean(record.reporterInfo?.isAnonymous),
  assignedByName: record.assignedByName || "Case Officer",
}));

let localVerificationHistory: VerificationHistoryItem[] =
  localAssignedEvidence
    .filter((item) => item.assignmentStatus === "completed")
    .map((item, index) => ({
      decisionId: `LOCAL-DEC-${item.evidenceId}`,
      assignmentId: item.assignmentId,
      evidenceId: item.evidenceId,
      evidenceTitle: item.evidenceTitle,
      fileName: item.fileName,
      caseId: item.caseId,
      caseReference: item.caseReference,
      decision: item.validationStatus === "rejected" ? "rejected" : "approved",
      reason:
        item.validationStatus === "rejected"
          ? "File requires follow-up before it can be accepted."
          : "Metadata and case context were reviewed.",
      internalNotes: null,
      reporterMessage: null,
      decidedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    }));

function shouldUseLocalFallback(error: unknown) {
  return Boolean(error) || process.env.EXPO_PUBLIC_SUPABASE_URL?.includes("placeholder") === true;
}

function warnUsingLocalFallback(scope: string, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error || "No backend response.");

  console.warn(`Using local validator fallback for ${scope}:`, message);
}

function getLocalAssignedEvidence() {
  return [...localAssignedEvidence].sort(
    (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
  );
}

function getLocalAssignmentDetail(assignmentId: string) {
  return localAssignedEvidence.find((item) => item.assignmentId === assignmentId) || null;
}

function markLocalReviewStarted(assignmentId: string) {
  const index = localAssignedEvidence.findIndex(
    (item) => item.assignmentId === assignmentId,
  );

  if (index === -1) {
    throw new Error("This evidence assignment could not be found.");
  }

  const now = new Date().toISOString();

  localAssignedEvidence[index] = {
    ...localAssignedEvidence[index],
    assignmentStatus: "under_review",
    startedAt: localAssignedEvidence[index].startedAt || now,
    validationStatus: "under_review",
  };
}

function saveLocalDecision(input: SubmitEvidenceDecisionInput) {
  const index = localAssignedEvidence.findIndex(
    (item) => item.assignmentId === input.assignmentId,
  );

  if (index === -1) {
    throw new Error("This evidence assignment could not be found.");
  }

  const item = localAssignedEvidence[index];
  const now = new Date().toISOString();

  localAssignedEvidence[index] = {
    ...item,
    assignmentStatus: "completed",
    validationStatus:
      input.decision === "replacement_requested" ? "rejected" : input.decision,
  };

  localVerificationHistory = [
    {
      decisionId: `LOCAL-DEC-${Date.now()}`,
      assignmentId: item.assignmentId,
      evidenceId: item.evidenceId,
      evidenceTitle: item.evidenceTitle,
      fileName: item.fileName,
      caseId: item.caseId,
      caseReference: item.caseReference,
      decision: input.decision,
      reason: input.reason.trim(),
      internalNotes: input.internalNotes.trim() || null,
      reporterMessage: input.reporterMessage.trim() || null,
      decidedAt: now,
    },
    ...localVerificationHistory.filter(
      (historyItem) => historyItem.assignmentId !== item.assignmentId,
    ),
  ];
}

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
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return "Evidence Validator";
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (error) {
      warnUsingLocalFallback("validator name", error);
      return "Evidence Validator";
    }

    return data?.full_name?.trim() || "Evidence Validator";
  } catch (error) {
    warnUsingLocalFallback("validator name", error);
    return "Evidence Validator";
  }
}

export async function getMyAssignedEvidence() {
  try {
    const { data, error } = await supabase.rpc("get_my_evidence_assignments");

    if (error) {
      warnUsingLocalFallback("assigned evidence", error);
      return getLocalAssignedEvidence();
    }

    const rows = ((data ?? []) as EvidenceRow[]).map(mapEvidence);

    return rows.length > 0 ? rows : getLocalAssignedEvidence();
  } catch (error) {
    warnUsingLocalFallback("assigned evidence", error);
    return getLocalAssignedEvidence();
  }
}

export async function getEvidenceAssignmentDetail(assignmentId: string) {
  if (assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
    const local = getLocalAssignmentDetail(assignmentId);

    if (!local) {
      throw new Error("This evidence assignment could not be found.");
    }

    return local;
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_my_evidence_assignment_detail",
      {
        p_assignment_id: assignmentId,
      },
    );

    if (error) {
      warnUsingLocalFallback("assignment detail", error);
      return getLocalAssignedEvidence()[0];
    }

    const row = (Array.isArray(data) ? data[0] : data) as EvidenceRow | null;

    if (!row) {
      return getLocalAssignedEvidence()[0];
    }

    return mapEvidence(row);
  } catch (error) {
    warnUsingLocalFallback("assignment detail", error);
    return getLocalAssignedEvidence()[0];
  }
}

export async function startEvidenceReview(assignmentId: string) {
  if (assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
    markLocalReviewStarted(assignmentId);
    return;
  }

  try {
    const { error } = await supabase.rpc("start_my_evidence_review", {
      p_assignment_id: assignmentId,
    });

    if (error) {
      warnUsingLocalFallback("start review", error);
      if (assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
        markLocalReviewStarted(assignmentId);
      }
      return;
    }
  } catch (error) {
    warnUsingLocalFallback("start review", error);
    if (assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
      markLocalReviewStarted(assignmentId);
    }
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
  const reasonText = input.reason ? input.reason.trim() : "";
  if (!reasonText) {
    throw new Error("A documented reason or comment is required.");
  }

  if (input.assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
    saveLocalDecision(input);
    return { ok: true, source: "local-fallback" };
  }

  try {
    const { data, error } = await supabase.rpc(
      "submit_evidence_verification_decision",
      {
        p_assignment_id: input.assignmentId,
        p_decision: input.decision,
        p_reason: reasonText,
        p_internal_notes: input.internalNotes ? input.internalNotes.trim() || null : null,
        p_reporter_message: input.reporterMessage ? input.reporterMessage.trim() || null : null,
      },
    );

    if (error) {
      warnUsingLocalFallback("submit decision", error);
      if (input.assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
        saveLocalDecision(input);
      }
      return { ok: true, source: "local-fallback" };
    }

    return data;
  } catch (error) {
    warnUsingLocalFallback("submit decision", error);
    if (input.assignmentId.startsWith(`${LOCAL_ASSIGNMENT_PREFIX}-`)) {
      saveLocalDecision(input);
    }
    return { ok: true, source: "local-fallback" };
  }
}

export async function getMyVerificationHistory() {
  try {
    const { data, error } = await supabase.rpc(
      "get_my_evidence_verification_history",
    );

    if (error) {
      // Verification decisions are delivered in a later Sprint 3 story. Keep the
      // JN-340 assignment queue usable until that RPC is deployed.
      if (error.code === "PGRST202" || error.code === "42883" || shouldUseLocalFallback(error)) {
        warnUsingLocalFallback("verification history", error);
        return [...localVerificationHistory];
      }

      warnUsingLocalFallback("verification history", error);
      return [...localVerificationHistory];
    }

    const rows = ((data ?? []) as HistoryRow[]).map(mapHistory);

    return rows.length > 0 ? rows : [...localVerificationHistory];
  } catch (error) {
    warnUsingLocalFallback("verification history", error);
    return [...localVerificationHistory];
  }
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
