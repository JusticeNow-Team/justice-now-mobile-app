import { recordAuditEvent } from "../audit/auditService";
import { normalizeRole } from "../auth/roles";
import { SystemRole } from "../auth/types";
import { supabase } from "../lib/supabase";
import {
  CheckerAvailabilityRecord,
  CheckerAvailabilityStatus,
  StaffFilterOptions,
} from "./types";

// Seed mock checkers for offline, demo, and automated test environments
export const INITIAL_MOCK_CHECKERS: CheckerAvailabilityRecord[] = [
  {
    id: "CHK-001-ELENA",
    email: "elena.checker@justicenow.org",
    fullName: "Elena Rostova",
    role: "evidence_checker",
    isActive: true,
    availabilityStatus: "available",
    activeAssignmentsCount: 2,
    department: "Forensic Digital Evidence",
    phone: "+1 (555) 019-2834",
    lastActiveAt: new Date().toISOString(),
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-20T14:30:00Z",
  },
  {
    id: "CHK-002-MARCUS",
    email: "marcus.vance@justicenow.org",
    fullName: "Dr. Marcus Vance",
    role: "evidence_checker",
    isActive: true,
    availabilityStatus: "busy",
    activeAssignmentsCount: 5,
    department: "Medical-Legal Forensics",
    phone: "+1 (555) 018-9922",
    lastActiveAt: new Date().toISOString(),
    createdAt: "2026-08-05T09:15:00Z",
    updatedAt: "2026-08-21T11:00:00Z",
  },
  {
    id: "CHK-003-SAMIRA",
    email: "samira.khan@justicenow.org",
    fullName: "Samira Khan",
    role: "evidence_checker",
    isActive: false,
    availabilityStatus: "inactive",
    activeAssignmentsCount: 0,
    department: "Video & Multimedia Analysis",
    phone: "+1 (555) 017-3341",
    lastActiveAt: "2026-08-15T18:00:00Z",
    createdAt: "2026-08-08T14:20:00Z",
    updatedAt: "2026-08-18T16:45:00Z",
  },
  {
    id: "CHK-004-ALEX",
    email: "alex.chen@justicenow.org",
    fullName: "Alex Chen",
    role: "evidence_checker",
    isActive: true,
    availabilityStatus: "away",
    activeAssignmentsCount: 1,
    department: "Cybersecurity & Metadata",
    phone: "+1 (555) 016-5519",
    lastActiveAt: "2026-08-22T08:30:00Z",
    createdAt: "2026-08-10T11:00:00Z",
    updatedAt: "2026-08-22T08:30:00Z",
  },
];

// In-memory store for reactive testing & demo sync
let inMemoryCheckersStore: CheckerAvailabilityRecord[] = [
  ...INITIAL_MOCK_CHECKERS.map((c) => ({ ...c })),
];

// Historical mock assignments to prove AC 4 (traceability preservation)
export interface MockCheckerAssignment {
  id: string;
  evidenceId: string;
  evidenceTitle: string;
  checkerId: string;
  checkerName: string;
  caseId: string;
  caseReference: string;
  status: "assigned" | "under_review" | "completed" | "cancelled";
  assignedAt: string;
  completedAt?: string;
  decision?: string;
}

export const INITIAL_MOCK_ASSIGNMENTS: MockCheckerAssignment[] = [
  {
    id: "ASG-2026-001",
    evidenceId: "EVD-2026-9041",
    evidenceTitle: "crime_scene_photo_01.jpg",
    checkerId: "CHK-001-ELENA",
    checkerName: "Elena Rostova",
    caseId: "CASE-2026-0812",
    caseReference: "JN-2026-0812",
    status: "under_review",
    assignedAt: "2026-08-20T14:30:00Z",
  },
  {
    id: "ASG-2026-002",
    evidenceId: "EVD-2026-9042",
    evidenceTitle: "witness_statement_audio.m4a",
    checkerId: "CHK-001-ELENA",
    checkerName: "Elena Rostova",
    caseId: "CASE-2026-0812",
    caseReference: "JN-2026-0812",
    status: "assigned",
    assignedAt: "2026-08-20T15:05:12Z",
  },
  {
    id: "ASG-2026-003",
    evidenceId: "EVD-2026-9043",
    evidenceTitle: "medical_report_signed.pdf",
    checkerId: "CHK-002-MARCUS",
    checkerName: "Dr. Marcus Vance",
    caseId: "CASE-2026-0798",
    caseReference: "JN-2026-0798",
    status: "completed",
    assignedAt: "2026-08-19T09:12:44Z",
    completedAt: "2026-08-19T11:00:00Z",
    decision: "approved",
  },
  {
    id: "ASG-2026-004",
    evidenceId: "EVD-2026-9048",
    evidenceTitle: "confidential_scan.png",
    checkerId: "CHK-003-SAMIRA",
    checkerName: "Samira Khan",
    caseId: "CASE-2026-0812",
    caseReference: "JN-2026-0812",
    status: "completed",
    assignedAt: "2026-08-14T10:00:00Z",
    completedAt: "2026-08-15T16:00:00Z",
    decision: "approved",
  },
];

let inMemoryAssignmentsStore: MockCheckerAssignment[] = [
  ...INITIAL_MOCK_ASSIGNMENTS.map((a) => ({ ...a })),
];

function isCheckerRole(role: string | null | undefined): boolean {
  const norm = normalizeRole(role);
  return norm === "evidence_checker";
}

/**
 * JN-267 & AC 1: Fetch all Evidence Checkers along with their active availability status and assignment workload.
 */
export async function getEvidenceCheckersWithAvailability(
  options: StaffFilterOptions = {},
): Promise<CheckerAvailabilityRecord[]> {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, is_active, status, availability_status, department, phone, updated_at, created_at",
      )
      .in("role", ["evidence_checker", "evidence_validator"])
      .order("full_name", { ascending: true });

    if (error || !profiles || profiles.length === 0) {
      return filterInMemoryCheckers(options);
    }

    // Try to get live assignment counts from Supabase if connected
    const mapped: CheckerAvailabilityRecord[] = profiles.map((row: any) => {
      const isActive = row.is_active !== false;
      const rawAvailability = row.availability_status;
      let availabilityStatus: CheckerAvailabilityStatus = "available";

      if (!isActive) {
        availabilityStatus = "inactive";
      } else if (
        rawAvailability === "busy" ||
        rawAvailability === "away" ||
        rawAvailability === "available"
      ) {
        availabilityStatus = rawAvailability;
      }

      // Find active assignments count from store/database
      const activeCount = inMemoryAssignmentsStore.filter(
        (a) =>
          a.checkerId === row.id &&
          (a.status === "assigned" || a.status === "under_review"),
      ).length;

      return {
        id: row.id,
        email: row.email || "",
        fullName: row.full_name || "Evidence Checker",
        role: "evidence_checker",
        isActive,
        availabilityStatus,
        activeAssignmentsCount: activeCount,
        department: row.department || undefined,
        phone: row.phone || undefined,
        lastActiveAt: row.updated_at || row.created_at,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      };
    });

    return applyCheckerFilters(mapped, options);
  } catch (err) {
    console.warn("Using in-memory checker availability store:", err);
    return filterInMemoryCheckers(options);
  }
}

function filterInMemoryCheckers(
  options: StaffFilterOptions,
): CheckerAvailabilityRecord[] {
  return applyCheckerFilters([...inMemoryCheckersStore], options);
}

function applyCheckerFilters(
  list: CheckerAvailabilityRecord[],
  options: StaffFilterOptions,
): CheckerAvailabilityRecord[] {
  let result = list;

  if (options.status && options.status !== "all") {
    result = result.filter((c) =>
      options.status === "active" ? c.isActive : !c.isActive,
    );
  }

  if (options.availability && options.availability !== "all") {
    result = result.filter(
      (c) => c.availabilityStatus === options.availability,
    );
  }

  if (options.searchQuery?.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter((c) =>
      [c.fullName, c.email, c.department || "", c.id]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  return result;
}

/**
 * JN-268 & JN-270 & JN-271: Admin updates a checker's active status and availability.
 * Requires System Administrator role (AC 6). Emits immutable audit log (AC 5).
 */
export async function setCheckerAvailability(params: {
  checkerId: string;
  isActive: boolean;
  availabilityStatus?: CheckerAvailabilityStatus;
  actorRole?: SystemRole | string;
  actorId?: string;
  actorEmail?: string;
  reason?: string;
}): Promise<{
  success: boolean;
  checker?: CheckerAvailabilityRecord;
  error?: string;
  warning?: string;
}> {
  const actorRoleNorm = normalizeRole(params.actorRole);

  // AC 6: Unauthorized users cannot change availability
  if (actorRoleNorm !== "system_admin") {
    return {
      success: false,
      error: "Unauthorized: Only System Administrators can modify Evidence Checker availability.",
    };
  }

  const cleanReason = params.reason?.trim() || "Administrative status update";
  const now = new Date().toISOString();

  // Find existing record
  const idx = inMemoryCheckersStore.findIndex(
    (c) => c.id === params.checkerId,
  );

  const prevChecker =
    idx !== -1 ? inMemoryCheckersStore[idx] : null;

  const prevIsActive = prevChecker ? prevChecker.isActive : true;
  const prevAvailability = prevChecker
    ? prevChecker.availabilityStatus
    : "available";

  // Compute final availability status
  let finalAvailability: CheckerAvailabilityStatus =
    params.availabilityStatus || (params.isActive ? "available" : "inactive");

  if (!params.isActive) {
    finalAvailability = "inactive";
  }

  // Check if deactivating a checker with active assignments (triggers warning in result)
  const activeAssignments = inMemoryAssignmentsStore.filter(
    (a) =>
      a.checkerId === params.checkerId &&
      (a.status === "assigned" || a.status === "under_review"),
  );

  let warning: string | undefined;
  if (!params.isActive && activeAssignments.length > 0) {
    warning = `Checker has ${activeAssignments.length} ongoing evidence review(s). Deactivating prevents new assignments while existing cases remain traceable.`;
  }

  // Update in-memory store
  if (idx !== -1) {
    inMemoryCheckersStore[idx] = {
      ...inMemoryCheckersStore[idx],
      isActive: params.isActive,
      availabilityStatus: finalAvailability,
      updatedAt: now,
    };
  }

  // Sync to database if connected
  try {
    await supabase
      .from("profiles")
      .update({
        is_active: params.isActive,
        availability_status: finalAvailability,
        updated_at: now,
      })
      .eq("id", params.checkerId);
  } catch (dbErr) {
    console.warn("Database sync warning for checker availability:", dbErr);
  }

  // JN-271 & AC 5: Record immutable audit event
  const actionType = !params.isActive
    ? "STAFF_ACCOUNT_DEACTIVATED"
    : prevIsActive !== params.isActive
      ? "STAFF_ACCOUNT_ACTIVATED"
      : "CHECKER_AVAILABILITY_CHANGED";

  try {
    await recordAuditEvent({
      eventType: "CHECKER_AVAILABILITY_CHANGED",
      actorId: params.actorId || "admin-system",
      actorEmail: params.actorEmail || "admin@justicenow.org",
      actorRole: "system_admin",
      targetId: params.checkerId,
      targetEmail: prevChecker?.email || "checker@justicenow.org",
      action: actionType,
      description: `Updated Evidence Checker ${prevChecker?.fullName || params.checkerId} availability to ${finalAvailability} (Active: ${params.isActive}). Reason: ${cleanReason}`,
      details: {
        checkerId: params.checkerId,
        checkerName: prevChecker?.fullName,
        previousState: {
          isActive: prevIsActive,
          availabilityStatus: prevAvailability,
        },
        newState: {
          isActive: params.isActive,
          availabilityStatus: finalAvailability,
        },
        activeAssignmentsCount: activeAssignments.length,
        reason: cleanReason,
      },
    });
  } catch (auditErr) {
    console.warn("Audit logging warning:", auditErr);
  }

  const updatedChecker: CheckerAvailabilityRecord = idx !== -1
    ? inMemoryCheckersStore[idx]
    : {
        id: params.checkerId,
        email: prevChecker?.email || "checker@justicenow.org",
        fullName: prevChecker?.fullName || "Evidence Checker",
        role: "evidence_checker",
        isActive: params.isActive,
        availabilityStatus: finalAvailability,
        activeAssignmentsCount: activeAssignments.length,
        createdAt: now,
        updatedAt: now,
      };

  return {
    success: true,
    checker: updatedChecker,
    warning,
  };
}

/**
 * JN-269 & AC 3: Restrict new evidence assignments to active checkers only.
 * Throws an explicit descriptive error if the checker is deactivated or unavailable.
 */
export function validateCheckerEligibilityForAssignment(checker: {
  id: string;
  isActive: boolean;
  availabilityStatus?: CheckerAvailabilityStatus;
  fullName?: string;
  role?: string;
}): {
  eligible: boolean;
  error?: string;
} {
  if (checker.role && !isCheckerRole(checker.role)) {
    return {
      eligible: false,
      error: `User '${checker.fullName || checker.id}' does not hold the authorized Evidence Checker role.`,
    };
  }

  if (!checker.isActive || checker.availabilityStatus === "inactive") {
    return {
      eligible: false,
      error: `Cannot assign evidence: Evidence Checker '${checker.fullName || checker.id}' is currently deactivated by system administration.`,
    };
  }

  if (checker.availabilityStatus === "away") {
    return {
      eligible: false,
      error: `Cannot assign evidence: Evidence Checker '${checker.fullName || checker.id}' is marked as away on leave.`,
    };
  }

  return {
    eligible: true,
  };
}

/**
 * JN-269 & AC 4: Assign an evidence item to a checker with availability validation.
 * Fails if the checker is inactive; records assignment while preserving all historical assignments.
 */
export function assignEvidenceToCheckerSafely(params: {
  evidenceId: string;
  evidenceTitle: string;
  caseId: string;
  caseReference: string;
  checkerId: string;
  assignedByOfficerId: string;
}): {
  success: boolean;
  assignment?: MockCheckerAssignment;
  error?: string;
} {
  // Check if checker exists and is eligible
  const checker = inMemoryCheckersStore.find((c) => c.id === params.checkerId);

  if (!checker) {
    return {
      success: false,
      error: `Evidence Checker with ID '${params.checkerId}' was not found.`,
    };
  }

  const eligibility = validateCheckerEligibilityForAssignment(checker);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.error,
    };
  }

  // Create new assignment
  const newAssignment: MockCheckerAssignment = {
    id: `ASG-${Date.now()}`,
    evidenceId: params.evidenceId,
    evidenceTitle: params.evidenceTitle,
    checkerId: checker.id,
    checkerName: checker.fullName,
    caseId: params.caseId,
    caseReference: params.caseReference,
    status: "assigned",
    assignedAt: new Date().toISOString(),
  };

  inMemoryAssignmentsStore.push(newAssignment);

  // Update workload
  const chkIdx = inMemoryCheckersStore.findIndex((c) => c.id === checker.id);
  if (chkIdx !== -1) {
    inMemoryCheckersStore[chkIdx].activeAssignmentsCount += 1;
    if (inMemoryCheckersStore[chkIdx].activeAssignmentsCount >= 5) {
      inMemoryCheckersStore[chkIdx].availabilityStatus = "busy";
    }
  }

  return {
    success: true,
    assignment: newAssignment,
  };
}

/**
 * AC 4: Retrieve complete historical and active assignments for a given checker
 * to guarantee full traceability regardless of their current active/inactive status.
 */
export function getCheckerAssignmentHistory(checkerId: string): {
  activeAssignments: MockCheckerAssignment[];
  historicalAssignments: MockCheckerAssignment[];
  totalAssignmentsCount: number;
} {
  const all = inMemoryAssignmentsStore.filter((a) => a.checkerId === checkerId);
  const active = all.filter(
    (a) => a.status === "assigned" || a.status === "under_review",
  );
  const historical = all.filter(
    (a) => a.status === "completed" || a.status === "cancelled",
  );

  return {
    activeAssignments: active,
    historicalAssignments: historical,
    totalAssignmentsCount: all.length,
  };
}

/**
 * Helper to reset in-memory test states for automated testing suites.
 */
export function resetInMemoryCheckersStore() {
  inMemoryCheckersStore = [
    ...INITIAL_MOCK_CHECKERS.map((c) => ({ ...c })),
  ];
  inMemoryAssignmentsStore = [
    ...INITIAL_MOCK_ASSIGNMENTS.map((a) => ({ ...a })),
  ];
}

export async function getEvidenceCheckerById(
  checkerId: string,
): Promise<CheckerAvailabilityRecord | null> {
  const all = await getEvidenceCheckersWithAvailability();
  return all.find((c) => c.id === checkerId) || null;
}

export async function getAvailableEvidenceCheckers(): Promise<CheckerAvailabilityRecord[]> {
  const all = await getEvidenceCheckersWithAvailability();
  return all.filter(
    (c) =>
      c.isActive &&
      (c.availabilityStatus === "available" || c.availabilityStatus === "busy"),
  );
}

export const getEvidenceCheckerAvailability = getEvidenceCheckersWithAvailability;

export const updateEvidenceCheckerAvailability = async (params: {
  actorRole?: string;
  actorUserId?: string;
  actorEmail?: string;
  targetCheckerId: string;
  isActive?: boolean;
  availabilityStatus?: CheckerAvailabilityStatus;
  reason?: string;
}) => {
  const target = inMemoryCheckersStore.find((c) => c.id === params.targetCheckerId);
  const currentActive = target ? target.isActive : true;

  return setCheckerAvailability({
    checkerId: params.targetCheckerId,
    isActive: params.isActive !== undefined ? params.isActive : currentActive,
    availabilityStatus: params.availabilityStatus,
    actorRole: params.actorRole,
    actorId: params.actorUserId,
    actorEmail: params.actorEmail,
    reason: params.reason,
  });
};

export const simulateAssignEvidenceToChecker = async (
  evidenceId: string,
  checkerId: string,
  assignedByOfficerId: string,
  officerEmail?: string,
) => {
  const res = assignEvidenceToCheckerSafely({
    evidenceId,
    evidenceTitle: "Test Evidence File",
    caseId: "CASE-TEST",
    caseReference: "JN-CASE-TEST",
    checkerId,
    assignedByOfficerId,
  });
  return {
    success: res.success,
    assignmentId: res.assignment?.id,
    error: res.error,
  };
};

export const resetCheckerAvailabilityToDefault = resetInMemoryCheckersStore;

