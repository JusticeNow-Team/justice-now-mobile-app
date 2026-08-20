import { supabase } from "../../lib/supabase";
import { asStatus } from "./getReporterCases";
import { ReporterCaseStatus } from "./types";

export interface ReporterCaseDetail {
  id: string;
  caseReference: string;
  title: string;
  description: string | null;
  category: string;
  incidentDate: string | null;
  district: string | null;
  status: ReporterCaseStatus;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReporterOfficerPublic {
  fullName: string;
  roleLabel: string;
}

export interface ReporterEvidenceRecord {
  id: string;
  title: string;
  fileName: string | null;
  evidenceType: string;
  fileSizeBytes: number | null;
  validationStatus: string;
  createdAt: string;
}

export interface ReporterStatusEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
}

export interface ReporterInformationAnswer {
  question: string;
  answer: string;
}

export interface ReporterInformationResponse {
  id: string;
  answers: ReporterInformationAnswer[];
  additionalMessage: string | null;
  submittedAt: string;
}

export interface ReporterInformationRequest {
  id: string;
  title: string;
  message: string;
  requestedItems: string[];
  requiresEvidence: boolean;
  dueDate: string | null;
  status: "sent" | "responded";
  sentAt: string;
  response: ReporterInformationResponse | null;
}

export type GetReporterCaseDetailResult =
  | {
      ok: true;
      detail: ReporterCaseDetail;
      officer: ReporterOfficerPublic | null;
      evidence: ReporterEvidenceRecord[];
      history: ReporterStatusEvent[];
      informationRequests: ReporterInformationRequest[];
    }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "generic";
      message: string;
    };

function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) {
    return null;
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatEvidenceSize(bytes: number | null) {
  return formatBytes(bytes) ?? "Size unknown";
}

function asInformationAnswers(value: unknown): ReporterInformationAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is {
        question: string;
        answer: string;
      } =>
        typeof item === "object" &&
        item !== null &&
        typeof (
          item as {
            question?: unknown;
          }
        ).question === "string" &&
        typeof (
          item as {
            answer?: unknown;
          }
        ).answer === "string",
    )
    .map((item) => ({
      question: item.question,
      answer: item.answer,
    }));
}

export async function getReporterCaseDetail(
  caseId: string,
): Promise<GetReporterCaseDetailResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to view this case.",
    };
  }

  const user = sessionData.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "reporter") {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "This area is only available to reporter accounts.",
    };
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select(
      `
        id,
        reporter_id,
        case_reference,
        title,
        description,
        category,
        incident_date,
        district,
        status,
        is_anonymous,
        created_at,
        updated_at
      `,
    )
    .eq("id", caseId)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (caseError) {
    return {
      ok: false,
      reason: "generic",
      message: caseError.message || "JusticeNow could not load this case.",
    };
  }

  if (!caseRow || caseRow.reporter_id !== user.id) {
    return {
      ok: false,
      reason: "forbidden",
      message: "This case is not available on your account.",
    };
  }

  const detail: ReporterCaseDetail = {
    id: caseRow.id,
    caseReference: caseRow.case_reference,
    title: caseRow.title,
    description: caseRow.description,
    category: caseRow.category,
    incidentDate: caseRow.incident_date,
    district: caseRow.district,
    status: asStatus(caseRow.status),
    isAnonymous: Boolean(caseRow.is_anonymous),
    createdAt: caseRow.created_at,
    updatedAt: caseRow.updated_at,
  };

  let officer: ReporterOfficerPublic | null = null;

  const { data: assignment } = await supabase
    .from("case_assignments")
    .select("assigned_officer_id, is_active")
    .eq("case_id", caseId)
    .eq("is_active", true)
    .maybeSingle();

  if (assignment?.assigned_officer_id) {
    const { data: officerProfile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", assignment.assigned_officer_id)
      .maybeSingle();

    if (officerProfile?.role === "case_officer") {
      officer = {
        fullName: officerProfile.full_name || "Assigned investigator",
        roleLabel: "Assigned investigator",
      };
    }
  }

  const { data: evidenceRows } = await supabase
    .from("case_evidence")
    .select(
      "id, title, file_name, evidence_type, file_size_bytes, validation_status, created_at",
    )
    .eq("case_id", caseId)
    .order("created_at", {
      ascending: false,
    });

  const evidence: ReporterEvidenceRecord[] = (evidenceRows ?? []).map(
    (row) => ({
      id: row.id,
      title: row.title,
      fileName: row.file_name,
      evidenceType: row.evidence_type,
      fileSizeBytes: row.file_size_bytes,
      validationStatus: row.validation_status,
      createdAt: row.created_at,
    }),
  );

  const { data: historyRows } = await supabase
    .from("case_status_history")
    .select("id, old_status, new_status, changed_at")
    .eq("case_id", caseId)
    .order("changed_at", {
      ascending: true,
    });

  const history: ReporterStatusEvent[] = (historyRows ?? []).map((row) => ({
    id: row.id,
    fromStatus: row.old_status,
    toStatus: row.new_status,
    changedAt: row.changed_at,
  }));

  const { data: requestRows, error: requestError } = await supabase
    .from("case_information_requests")
    .select(
      `
        id,
        title,
        message,
        requested_items,
        requires_evidence,
        due_date,
        status,
        sent_at,
        case_information_responses (
          id,
          answers,
          additional_message,
          submitted_at
        )
      `,
    )
    .eq("case_id", caseId)
    .eq("reporter_id", user.id)
    .in("status", ["sent", "responded"])
    .order("created_at", {
      ascending: false,
    });

  if (requestError) {
    return {
      ok: false,
      reason: "generic",
      message:
        requestError.message ||
        "JusticeNow could not load information requests for this case.",
    };
  }

  const informationRequests: ReporterInformationRequest[] = (
    requestRows ?? []
  ).map((row) => {
    const nested = row.case_information_responses;

    const responseRow = Array.isArray(nested) ? nested[0] : nested;

    return {
      id: row.id,
      title: row.title,
      message: row.message,
      requestedItems: row.requested_items ?? [],
      requiresEvidence: Boolean(row.requires_evidence),
      dueDate: row.due_date,
      status: row.status === "responded" ? "responded" : "sent",
      sentAt: row.sent_at,
      response: responseRow
        ? {
            id: responseRow.id,
            answers: asInformationAnswers(responseRow.answers),
            additionalMessage: responseRow.additional_message,
            submittedAt: responseRow.submitted_at,
          }
        : null,
    };
  });

  return {
    ok: true,
    detail,
    officer,
    evidence,
    history,
    informationRequests,
  };
}
