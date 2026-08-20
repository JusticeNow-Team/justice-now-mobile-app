import { supabase } from "../lib/supabase";
import {
  AssignedEvidenceItem,
  AssignEvidenceResult,
  EvidenceAssignmentSummary,
  EvidenceChecker,
} from "./types";

type CheckerRow = {
  id: string;
  full_name: string;
  active_assignment_count: number | string;
};

type AssignmentRow = {
  assignment_id: string;
  evidence_id: string;
  checker_id: string;
  checker_name: string;
  status: EvidenceAssignmentSummary["status"];
  assigned_at: string;
};

type AssignedEvidenceRow = {
  assignment_id: string;
  assignment_status: AssignedEvidenceItem["assignmentStatus"];
  assigned_at: string;
  evidence_id: string;
  evidence_type: string;
  evidence_title: string;
  evidence_description: string | null;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  validation_status: string;
  case_id: string;
  case_reference: string;
  case_title: string;
  assigned_by_name: string;
};

function mapAssignment(
  row: AssignmentRow,
): EvidenceAssignmentSummary {
  return {
    assignmentId: row.assignment_id,
    evidenceId: row.evidence_id,
    checkerId: row.checker_id,
    checkerName: row.checker_name,
    status: row.status,
    assignedAt: row.assigned_at,
  };
}

export async function getAvailableEvidenceCheckers(
  caseId: string,
) {
  const { data, error } = await supabase.rpc(
    "get_available_evidence_checkers",
    {
      p_case_id: caseId,
    },
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as CheckerRow[]).map(
    (row): EvidenceChecker => ({
      id: row.id,
      fullName: row.full_name,
      activeAssignmentCount: Number(
        row.active_assignment_count,
      ),
    }),
  );
}

export async function getOfficerEvidenceAssignments(
  caseId?: string,
) {
  const { data, error } = await supabase.rpc(
    "get_officer_evidence_assignments",
    {
      p_case_id: caseId ?? null,
    },
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as AssignmentRow[]).map(
    mapAssignment,
  );
}

export async function assignEvidenceToChecker(
  evidenceId: string,
  checkerId: string,
): Promise<AssignEvidenceResult> {
  const { data, error } = await supabase.rpc(
    "assign_evidence_to_checker",
    {
      p_evidence_id: evidenceId,
      p_checker_id: checkerId,
    },
  );

  const row = (
    Array.isArray(data) ? data[0] : data
  ) as AssignmentRow | null;

  if (error || !row) {
    return {
      ok: false,
      message:
        error?.message ||
        "JusticeNow could not assign this evidence.",
    };
  }

  return {
    ok: true,
    assignment: mapAssignment(row),
  };
}

export async function getMyEvidenceAssignments() {
  const { data, error } = await supabase.rpc(
    "get_my_evidence_assignments",
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as AssignedEvidenceRow[]).map(
    (row): AssignedEvidenceItem => ({
      assignmentId: row.assignment_id,
      assignmentStatus: row.assignment_status,
      assignedAt: row.assigned_at,
      evidenceId: row.evidence_id,
      evidenceType: row.evidence_type,
      evidenceTitle: row.evidence_title,
      evidenceDescription: row.evidence_description,
      fileName: row.file_name,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      validationStatus: row.validation_status,
      caseId: row.case_id,
      caseReference: row.case_reference,
      caseTitle: row.case_title,
      assignedByName: row.assigned_by_name,
    }),
  );
}