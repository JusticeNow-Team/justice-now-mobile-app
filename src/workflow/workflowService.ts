import { AuthorizationError } from "../auth/middleware";
import { normalizeRole } from "../auth/roles";
import { supabase } from "../lib/supabase";
import {
  CaseStatusBreakdown,
  CaseWorkflowStatus,
  EvidenceStatusBreakdown,
  EvidenceWorkflowStatus,
  WorkflowCaseItem,
  WorkflowDashboardMetrics,
  WorkflowDelayItem,
  WorkflowEvidenceItem,
  WorkflowFilterOptions,
} from "./types";

// ============================================================================
// DEFAULT MOCK SEEDS FOR OFFLINE / TEST / DEMO PREVIEW
// ============================================================================

export const INITIAL_MOCK_WORKFLOW_CASES: WorkflowCaseItem[] = [
  {
    id: "CASE-2026-0801",
    caseReference: "JN-2026-0801",
    title: "Unlawful Detention at Sector 4 Checkpoint",
    status: "submitted",
    priority: "urgent",
    category: "Civil Rights & Arbitrary Detention",
    submittedAt: "2026-09-15T08:00:00.000Z", // > 96h ago (Critical Delay)
    lastUpdatedAt: "2026-09-15T08:00:00.000Z",
    evidenceCount: 3,
  },
  {
    id: "CASE-2026-0802",
    caseReference: "JN-2026-0802",
    title: "Disproportionate Use of Force During Peaceful Protest",
    status: "under_review",
    priority: "high",
    category: "Physical Integrity & Police Misconduct",
    assignedOfficerId: "usr_off_01",
    assignedOfficerName: "Case Officer S. Silva",
    submittedAt: "2026-09-16T10:30:00.000Z", // > 72h ago (Warning Delay)
    lastUpdatedAt: "2026-09-16T11:00:00.000Z",
    evidenceCount: 4,
  },
  {
    id: "CASE-2026-0803",
    caseReference: "JN-2026-0803",
    title: "Confiscation of Press Credentials at Ministry Briefing",
    status: "investigating",
    priority: "medium",
    category: "Freedom of Expression & Press Freedom",
    assignedOfficerId: "usr_off_02",
    assignedOfficerName: "Case Officer K. Perera",
    submittedAt: "2026-09-17T09:15:00.000Z",
    lastUpdatedAt: "2026-09-18T14:20:00.000Z",
    evidenceCount: 2,
  },
  {
    id: "CASE-2026-0804",
    caseReference: "JN-2026-0804",
    title: "Interrogation of Human Rights Attorney",
    status: "awaiting_information",
    priority: "high",
    category: "Harassment of Legal Advocates",
    assignedOfficerId: "usr_off_01",
    assignedOfficerName: "Case Officer S. Silva",
    submittedAt: "2026-09-17T14:00:00.000Z",
    lastUpdatedAt: "2026-09-18T10:00:00.000Z",
    evidenceCount: 1,
  },
  {
    id: "CASE-2026-0805",
    caseReference: "JN-2026-0805",
    title: "Illegal Surveillance of Community Organizers",
    status: "action_taken",
    priority: "urgent",
    category: "Digital Privacy & State Surveillance",
    assignedOfficerId: "usr_off_02",
    assignedOfficerName: "Case Officer K. Perera",
    submittedAt: "2026-09-16T15:00:00.000Z",
    lastUpdatedAt: "2026-09-19T08:30:00.000Z",
    evidenceCount: 5,
  },
  {
    id: "CASE-2026-0806",
    caseReference: "JN-2026-0806",
    title: "Arbitrary Property Demolition in North Ward",
    status: "resolved",
    priority: "medium",
    category: "Housing & Property Rights",
    assignedOfficerId: "usr_off_01",
    assignedOfficerName: "Case Officer S. Silva",
    submittedAt: "2026-09-10T11:00:00.000Z",
    lastUpdatedAt: "2026-09-18T16:00:00.000Z",
    evidenceCount: 3,
  },
  {
    id: "CASE-2026-0807",
    caseReference: "JN-2026-0807",
    title: "Workplace Discrimination Duplicate Submission",
    status: "dismissed",
    priority: "low",
    category: "Labor Rights",
    submittedAt: "2026-09-12T08:00:00.000Z",
    lastUpdatedAt: "2026-09-13T09:00:00.000Z",
    evidenceCount: 0,
  },
  {
    id: "CASE-2026-0808",
    caseReference: "JN-2026-0808",
    title: "Reporter Withdrawn Report on Border Curfew",
    status: "withdrawn",
    priority: "low",
    category: "Freedom of Movement",
    submittedAt: "2026-09-11T13:00:00.000Z",
    lastUpdatedAt: "2026-09-14T11:00:00.000Z",
    evidenceCount: 1,
  },
];

export const INITIAL_MOCK_WORKFLOW_EVIDENCE: WorkflowEvidenceItem[] = [
  {
    id: "EVD-2026-9001",
    caseId: "CASE-2026-0801",
    caseReference: "JN-2026-0801",
    fileName: "checkpoint_cctv_footage_01.mp4",
    fileType: "video/mp4",
    status: "pending",
    uploadedAt: "2026-09-14T09:00:00.000Z", // > 120h ago (Critical Delay)
    lastUpdatedAt: "2026-09-14T09:00:00.000Z",
  },
  {
    id: "EVD-2026-9002",
    caseId: "CASE-2026-0801",
    caseReference: "JN-2026-0801",
    fileName: "detention_intake_receipt.pdf",
    fileType: "application/pdf",
    status: "under_review",
    assignedCheckerId: "usr_chk_01",
    assignedCheckerName: "Analyst N. Fernando",
    uploadedAt: "2026-09-15T10:30:00.000Z", // > 96h ago (Warning Delay)
    lastUpdatedAt: "2026-09-16T08:00:00.000Z",
  },
  {
    id: "EVD-2026-9003",
    caseId: "CASE-2026-0802",
    caseReference: "JN-2026-0802",
    fileName: "scene_injury_photo_front.jpg",
    fileType: "image/jpeg",
    status: "approved",
    assignedCheckerId: "usr_chk_01",
    assignedCheckerName: "Analyst N. Fernando",
    uploadedAt: "2026-09-16T11:00:00.000Z",
    lastUpdatedAt: "2026-09-17T14:30:00.000Z",
  },
  {
    id: "EVD-2026-9004",
    caseId: "CASE-2026-0802",
    caseReference: "JN-2026-0802",
    fileName: "medical_forensic_report.pdf",
    fileType: "application/pdf",
    status: "validated",
    assignedCheckerId: "usr_chk_02",
    assignedCheckerName: "Specialist K. Perera",
    uploadedAt: "2026-09-16T12:00:00.000Z",
    lastUpdatedAt: "2026-09-17T16:00:00.000Z",
  },
  {
    id: "EVD-2026-9005",
    caseId: "CASE-2026-0803",
    caseReference: "JN-2026-0803",
    fileName: "corrupt_audio_recording.m4a",
    fileType: "audio/m4a",
    status: "rejected",
    assignedCheckerId: "usr_chk_02",
    assignedCheckerName: "Specialist K. Perera",
    uploadedAt: "2026-09-17T09:30:00.000Z",
    lastUpdatedAt: "2026-09-18T11:15:00.000Z",
  },
  {
    id: "EVD-2026-9006",
    caseId: "CASE-2026-0804",
    caseReference: "JN-2026-0804",
    fileName: "blurry_witness_affidavit.jpg",
    fileType: "image/jpeg",
    status: "info_requested",
    assignedCheckerId: "usr_chk_01",
    assignedCheckerName: "Analyst N. Fernando",
    uploadedAt: "2026-09-17T14:30:00.000Z",
    lastUpdatedAt: "2026-09-18T10:30:00.000Z",
  },
  {
    id: "EVD-2026-9007",
    caseId: "CASE-2026-0805",
    caseReference: "JN-2026-0805",
    fileName: "malware_telemetry_dump.json",
    fileType: "application/json",
    status: "escalated",
    assignedCheckerId: "usr_chk_02",
    assignedCheckerName: "Specialist K. Perera",
    uploadedAt: "2026-09-18T08:00:00.000Z",
    lastUpdatedAt: "2026-09-19T09:00:00.000Z",
  },
  {
    id: "EVD-2026-9008",
    caseId: "CASE-2026-0805",
    caseReference: "JN-2026-0805",
    fileName: "device_log_archive.zip",
    fileType: "application/zip",
    status: "reassignment_requested",
    assignedCheckerId: "usr_chk_01",
    assignedCheckerName: "Analyst N. Fernando",
    uploadedAt: "2026-09-18T09:00:00.000Z",
    lastUpdatedAt: "2026-09-19T07:45:00.000Z",
  },
];

// In-memory test and runtime stores
let inMemoryWorkflowCases: WorkflowCaseItem[] = [
  ...INITIAL_MOCK_WORKFLOW_CASES.map((c) => ({ ...c })),
];
let inMemoryWorkflowEvidence: WorkflowEvidenceItem[] = [
  ...INITIAL_MOCK_WORKFLOW_EVIDENCE.map((e) => ({ ...e })),
];

// ============================================================================
// SECURITY & ROLE GUARDS (AC 6)
// ============================================================================

export function requireAdministrator(actorRole?: string) {
  if (normalizeRole(actorRole) !== "system_admin") {
    throw new AuthorizationError(
      `Unauthorized: Workflow Activity Dashboard is strictly restricted to System Administrators. Current role: ${actorRole ?? "anonymous"}`,
      "UNAUTHORIZED_WORKFLOW_ACCESS",
      403,
    );
  }
}

// ============================================================================
// METRIC CALCULATION ENGINE (AC 1 - 5, JN-287, JN-288)
// ============================================================================

const TERMINAL_CASE_STATUSES: CaseWorkflowStatus[] = [
  "resolved",
  "dismissed",
  "withdrawn",
  "closed",
];

export function isCaseActive(status: CaseWorkflowStatus): boolean {
  return !TERMINAL_CASE_STATUSES.includes(status);
}

export function isCaseAwaitingInitialReview(status: CaseWorkflowStatus): boolean {
  return status === "submitted" || status === "under_review";
}

export function isEvidenceAwaitingVerification(status: EvidenceWorkflowStatus): boolean {
  return status === "pending" || status === "under_review";
}

export function isEvidenceVerificationCompleted(status: EvidenceWorkflowStatus): boolean {
  return status === "approved" || status === "validated" || status === "rejected";
}

export function getCaseStatusBreakdown(cases: WorkflowCaseItem[]): CaseStatusBreakdown[] {
  const total = cases.length;

  const STATUS_CONFIGS: {
    status: CaseWorkflowStatus;
    label: string;
    tone: "info" | "warning" | "success" | "neutral" | "danger";
  }[] = [
    { status: "submitted", label: "Submitted (Intake)", tone: "info" },
    { status: "under_review", label: "Under Review", tone: "warning" },
    { status: "investigating", label: "Under Investigation", tone: "info" },
    { status: "awaiting_information", label: "Awaiting Info", tone: "warning" },
    { status: "action_taken", label: "Action Taken", tone: "success" },
    { status: "resolved", label: "Resolved", tone: "success" },
    { status: "dismissed", label: "Dismissed", tone: "neutral" },
    { status: "withdrawn", label: "Withdrawn", tone: "neutral" },
  ];

  return STATUS_CONFIGS.map((cfg) => {
    const count = cases.filter((c) => c.status === cfg.status).length;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      status: cfg.status,
      label: cfg.label,
      count,
      percentage,
      tone: cfg.tone,
      isActiveWorkflow: isCaseActive(cfg.status),
    };
  });
}

export function getEvidenceStatusBreakdown(
  evidence: WorkflowEvidenceItem[],
): EvidenceStatusBreakdown[] {
  const total = evidence.length;

  const STATUS_CONFIGS: {
    status: EvidenceWorkflowStatus;
    label: string;
    tone: "info" | "warning" | "success" | "neutral" | "danger";
  }[] = [
    { status: "pending", label: "Pending Review", tone: "warning" },
    { status: "under_review", label: "Under Verification", tone: "info" },
    { status: "approved", label: "Approved (Verified)", tone: "success" },
    { status: "validated", label: "Validated", tone: "success" },
    { status: "rejected", label: "Rejected", tone: "danger" },
    { status: "info_requested", label: "Clarification Requested", tone: "warning" },
    { status: "reassignment_requested", label: "Reassignment Requested", tone: "warning" },
    { status: "escalated", label: "Escalated for Review", tone: "danger" },
  ];

  return STATUS_CONFIGS.map((cfg) => {
    const count = evidence.filter((e) => e.status === cfg.status).length;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      status: cfg.status,
      label: cfg.label,
      count,
      percentage,
      tone: cfg.tone,
      isAwaitingVerification: isEvidenceAwaitingVerification(cfg.status),
      isCompleted: isEvidenceVerificationCompleted(cfg.status),
    };
  });
}

export function detectWorkflowDelays(
  cases: WorkflowCaseItem[],
  evidence: WorkflowEvidenceItem[],
  nowTimestamp: string = new Date().toISOString(),
): WorkflowDelayItem[] {
  const alerts: WorkflowDelayItem[] = [];
  const now = new Date(nowTimestamp).getTime();

  // 1. Case Delays: Cases in intake (submitted, under_review) awaiting review > 48h
  for (const c of cases) {
    if (isCaseAwaitingInitialReview(c.status)) {
      const createdTime = new Date(c.submittedAt).getTime();
      const diffHours = Math.floor((now - createdTime) / (1000 * 60 * 60));

      if (diffHours >= 48) {
        alerts.push({
          id: `delay_case_${c.id}`,
          itemType: "case",
          reference: c.caseReference,
          title: c.title,
          status: c.status,
          durationHours: diffHours,
          severity: diffHours >= 96 ? "critical" : "warning",
          assignedTo: c.assignedOfficerName || "Unassigned Intake",
          createdAt: c.submittedAt,
        });
      }
    }
  }

  // 2. Evidence Delays: Evidence in queue (pending, under_review) > 72h
  for (const e of evidence) {
    if (isEvidenceAwaitingVerification(e.status)) {
      const uploadedTime = new Date(e.uploadedAt).getTime();
      const diffHours = Math.floor((now - uploadedTime) / (1000 * 60 * 60));

      if (diffHours >= 72) {
        alerts.push({
          id: `delay_ev_${e.id}`,
          itemType: "evidence",
          reference: `${e.caseReference} · ${e.fileName}`,
          title: `Evidence verification pending for ${e.fileName}`,
          status: e.status,
          durationHours: diffHours,
          severity: diffHours >= 120 ? "critical" : "warning",
          assignedTo: e.assignedCheckerName || "Unassigned Queue",
          createdAt: e.uploadedAt,
        });
      }
    }
  }

  // Sort delays descending by duration
  return alerts.sort((a, b) => b.durationHours - a.durationHours);
}

// ============================================================================
// MAIN METRICS QUERY FUNCTION (JN-288, AC 1 - 7)
// ============================================================================

export async function getWorkflowDashboardMetrics(
  filterOptions?: WorkflowFilterOptions,
  actorRole = "system_admin",
): Promise<WorkflowDashboardMetrics> {
  requireAdministrator(actorRole);

  let cases: WorkflowCaseItem[] = [];
  let evidence: WorkflowEvidenceItem[] = [];
  let dataSource: "live" | "fallback" = "fallback";

  try {
    // Attempt live Supabase query
    const { data: casesData, error: casesError } = await supabase
      .from("cases")
      .select("id, case_reference, title, status, priority, category, created_at, updated_at");

    const { data: evidenceData, error: evidenceError } = await supabase
      .from("case_evidence")
      .select("id, case_id, file_name, file_type, validation_status, created_at, updated_at");

    if (!casesError && !evidenceError && casesData && evidenceData) {
      dataSource = "live";
      cases = casesData.map((row: any) => ({
        id: row.id,
        caseReference: row.case_reference || `JN-${row.id.slice(0, 8)}`,
        title: row.title || "Untitled Incident",
        status: (row.status || "submitted") as CaseWorkflowStatus,
        priority: (row.priority || "medium") as any,
        category: row.category || "General Rights",
        submittedAt: row.created_at || new Date().toISOString(),
        lastUpdatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        evidenceCount: 0,
      }));

      evidence = evidenceData.map((row: any) => ({
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
      cases = [...inMemoryWorkflowCases];
      evidence = [...inMemoryWorkflowEvidence];
    }
  } catch {
    cases = [...inMemoryWorkflowCases];
    evidence = [...inMemoryWorkflowEvidence];
  }

  // Apply optional filters if specified
  if (filterOptions?.category) {
    cases = cases.filter((c) => c.category.toLowerCase().includes(filterOptions.category!.toLowerCase()));
  }
  if (filterOptions?.priority) {
    cases = cases.filter((c) => c.priority === filterOptions.priority);
  }

  // Compute Core Metrics (AC 1–4)
  const totalActiveCases = cases.filter((c) => isCaseActive(c.status)).length;
  const casesAwaitingInitialReview = cases.filter((c) => isCaseAwaitingInitialReview(c.status)).length;
  const evidenceAwaitingVerification = evidence.filter((e) => isEvidenceAwaitingVerification(e.status)).length;
  const completedVerificationCount = evidence.filter((e) => isEvidenceVerificationCompleted(e.status)).length;

  const resolvedCasesCount = cases.filter((c) => c.status === "resolved").length;
  const delayAlerts = detectWorkflowDelays(cases, evidence);
  const delayedCasesCount = delayAlerts.filter((a) => a.itemType === "case").length;
  const delayedEvidenceCount = delayAlerts.filter((a) => a.itemType === "evidence").length;

  const activeOfficers = new Set(cases.map((c) => c.assignedOfficerId).filter(Boolean)).size;
  const activeCheckers = new Set(evidence.map((e) => e.assignedCheckerId).filter(Boolean)).size;

  return {
    totalActiveCases,
    casesAwaitingInitialReview,
    evidenceAwaitingVerification,
    completedVerificationCount,
    totalCasesCount: cases.length,
    totalEvidenceCount: evidence.length,
    resolvedCasesCount,
    delayedCasesCount,
    delayedEvidenceCount,
    activeOfficersCount: Math.max(activeOfficers, 2),
    activeCheckersCount: Math.max(activeCheckers, 2),
    caseStatusBreakdown: getCaseStatusBreakdown(cases),
    evidenceStatusBreakdown: getEvidenceStatusBreakdown(evidence),
    delayAlerts,
    computedAt: new Date().toISOString(),
    dataSource,
  };
}

// ============================================================================
// TEST ISOLATION & STORE MANAGEMENT
// ============================================================================

export function resetWorkflowStoreForTesting(
  overrideCases?: WorkflowCaseItem[],
  overrideEvidence?: WorkflowEvidenceItem[],
) {
  inMemoryWorkflowCases = overrideCases
    ? overrideCases.map((c) => ({ ...c }))
    : [...INITIAL_MOCK_WORKFLOW_CASES.map((c) => ({ ...c }))];

  inMemoryWorkflowEvidence = overrideEvidence
    ? overrideEvidence.map((e) => ({ ...e }))
    : [...INITIAL_MOCK_WORKFLOW_EVIDENCE.map((e) => ({ ...e }))];
}

export function setEmptyWorkflowStoreForTesting() {
  inMemoryWorkflowCases = [];
  inMemoryWorkflowEvidence = [];
}
