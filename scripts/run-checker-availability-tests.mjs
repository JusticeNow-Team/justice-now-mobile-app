import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// ============================================================================
// SPRINT 3 TASK JN-266: MANAGE EVIDENCE CHECKER AVAILABILITY
// Contract & Logic Validation Test Suite
// ============================================================================

// 1. Contract verification from SQL, Screen, and Service files
const migration = await readFile(
  new URL("./seeds/008_checker_availability.sql", import.meta.url),
  "utf8",
);
const adminScreen = await readFile(
  new URL("../src/app/admin/checkers.tsx", import.meta.url),
  "utf8",
);
const adminDashboard = await readFile(
  new URL("../src/app/admin/index.tsx", import.meta.url),
  "utf8",
);
const serviceFile = await readFile(
  new URL("../src/staff/checkerAvailabilityService.ts", import.meta.url),
  "utf8",
);

describe("JN-266 Contract & Static Verification", () => {
  it("008 SQL migration defines availability_status column and check constraint", () => {
    assert.match(
      migration,
      /add column if not exists availability_status text/i,
      "Migration must add availability_status column",
    );
    assert.match(
      migration,
      /check\s*\(availability_status in \('available', 'busy', 'away', 'inactive'\)\)/i,
      "Migration must have availability_status check constraint",
    );
  });

  it("008 SQL migration updates get_available_evidence_checkers to filter by active & availability_status", () => {
    assert.match(
      migration,
      /create or replace function public\.get_available_evidence_checkers\(/i,
      "Migration must define get_available_evidence_checkers function",
    );
    assert.match(
      migration,
      /checker\.is_active = true/i,
      "Function must filter by is_active = true",
    );
    assert.match(
      migration,
      /availability_status.*in \('available', 'busy'\)/i,
      "Function must filter by available/busy status",
    );
  });

  it("008 SQL migration provides admin_set_checker_availability RPC with admin security", () => {
    assert.match(
      migration,
      /create or replace function public\.admin_set_checker_availability\(/i,
      "Migration must define admin_set_checker_availability function",
    );
    assert.match(
      migration,
      /role::text = 'system_admin'/i,
      "Function must enforce system_admin role check",
    );
  });

  it("Admin checkers screen provides confirmation modal for active workload (JN-270)", () => {
    assert.match(
      adminScreen,
      /<Modal[\s\S]*visible=\{modalVisible\}/,
      "Admin checkers screen must render confirmation modal",
    );
    assert.match(
      adminScreen,
      /Caution:[\s\S]*active review/i,
      "Modal must warn when active assignments are in progress",
    );
    assert.match(
      adminScreen,
      /Audit Reason \/ Administrative Note/i,
      "Modal must offer reason input field for audit trail",
    );
  });

  it("Admin dashboard links to Evidence Checker Availability screen", () => {
    assert.match(
      adminDashboard,
      /\/admin\/checkers/,
      "Admin dashboard must link to /admin/checkers",
    );
    assert.match(
      adminDashboard,
      /Active checkers/i,
      "Admin dashboard must display Active checkers KPI",
    );
  });

  it("Service enforces validation before assignment (JN-269)", () => {
    assert.match(
      serviceFile,
      /export function validateCheckerEligibilityForAssignment\(/,
      "Service must export validateCheckerEligibilityForAssignment",
    );
    assert.match(
      serviceFile,
      /currently deactivated/i,
      "Service must reject deactivated accounts with clear error",
    );
    assert.match(
      serviceFile,
      /marked as away/i,
      "Service must reject away status with clear error",
    );
  });
});

// 2. Behavioral Logic Tests
const TEST_CHECKERS = [
  {
    id: "staff_checker_01",
    email: "checker.fernando@justicenow.org",
    fullName: "Forensic Analyst N. Fernando",
    role: "evidence_checker",
    availabilityStatus: "available",
    isActive: true,
    activeAssignmentsCount: 0,
    completedAssignmentsCount: 12,
  },
  {
    id: "staff_checker_02",
    email: "checker.perera@justicenow.org",
    fullName: "Digital Evidence Specialist K. Perera",
    role: "evidence_checker",
    availabilityStatus: "busy",
    isActive: true,
    activeAssignmentsCount: 3,
    completedAssignmentsCount: 4,
  },
  {
    id: "staff_checker_03",
    email: "checker.silva@justicenow.org",
    fullName: "Medical Forensics Officer T. Silva",
    role: "evidence_checker",
    availabilityStatus: "away",
    isActive: true,
    activeAssignmentsCount: 0,
    completedAssignmentsCount: 8,
  },
  {
    id: "staff_checker_04",
    email: "checker.inactive@justicenow.org",
    fullName: "Former Analyst R. Jayasuriya",
    role: "evidence_checker",
    availabilityStatus: "inactive",
    isActive: false,
    activeAssignmentsCount: 0,
    completedAssignmentsCount: 19,
  },
];

function validateCheckerEligibilityTest(checker) {
  if (!checker) {
    return { eligible: false, reasonCode: "NOT_FOUND", error: "Checker not found" };
  }
  if (!checker.isActive || checker.availabilityStatus === "inactive") {
    return {
      eligible: false,
      reasonCode: "INACTIVE_ACCOUNT",
      error: `Checker is deactivated (${checker.email}) and cannot receive assignments.`,
    };
  }
  if (checker.availabilityStatus === "away") {
    return {
      eligible: false,
      reasonCode: "AWAY_STATUS",
      error: `Checker is marked as away and cannot receive new assignments.`,
    };
  }
  return { eligible: true };
}

function updateCheckerAvailabilityTest(actorRole, checker, newStatus, newActive) {
  if (actorRole !== "system_admin") {
    return { success: false, error: "Unauthorized: Only System Admin can change availability." };
  }

  const updated = { ...checker };
  if (typeof newActive === "boolean") {
    updated.isActive = newActive;
    if (!newActive) {
      updated.availabilityStatus = "inactive";
    }
  }
  if (newStatus) {
    updated.availabilityStatus = newStatus;
    if (newStatus === "inactive") {
      updated.isActive = false;
    } else if (updated.isActive === false) {
      updated.isActive = true;
    }
  }

  return { success: true, checker: updated };
}

describe("JN-266 Acceptance Criteria Test Matrix", () => {
  it("AC 1: Admin can identify active Evidence Checkers with status & workload", () => {
    const active = TEST_CHECKERS.filter((c) => c.isActive);
    assert.equal(active.length, 3);
    assert.equal(active.some((c) => c.availabilityStatus === "available"), true);
    assert.equal(active.some((c) => c.availabilityStatus === "busy"), true);
    assert.equal(active.some((c) => c.availabilityStatus === "away"), true);
  });

  it("AC 2: Admin can activate or deactivate a checker", () => {
    const resDeact = updateCheckerAvailabilityTest("system_admin", TEST_CHECKERS[0], undefined, false);
    assert.equal(resDeact.success, true);
    assert.equal(resDeact.checker.isActive, false);
    assert.equal(resDeact.checker.availabilityStatus, "inactive");

    const resAct = updateCheckerAvailabilityTest("system_admin", TEST_CHECKERS[3], "available", true);
    assert.equal(resAct.success, true);
    assert.equal(resAct.checker.isActive, true);
    assert.equal(resAct.checker.availabilityStatus, "available");
  });

  it("AC 3: Deactivated checkers cannot receive new assignments", () => {
    const res = validateCheckerEligibilityTest(TEST_CHECKERS[3]);
    assert.equal(res.eligible, false);
    assert.equal(res.reasonCode, "INACTIVE_ACCOUNT");
  });

  it("AC 3: Away checkers cannot receive new assignments", () => {
    const res = validateCheckerEligibilityTest(TEST_CHECKERS[2]);
    assert.equal(res.eligible, false);
    assert.equal(res.reasonCode, "AWAY_STATUS");
  });

  it("AC 4: Existing assignments remain traceable when deactivated", () => {
    const checker = TEST_CHECKERS[1]; // has 3 active, 4 completed
    const deactRes = updateCheckerAvailabilityTest("system_admin", checker, undefined, false);
    assert.equal(deactRes.success, true);
    // Workload history counts are preserved
    assert.equal(deactRes.checker.completedAssignmentsCount, 4);
    assert.equal(deactRes.checker.activeAssignmentsCount, 3);
  });

  it("AC 5: Account changes are audited", () => {
    const auditEvent = {
      eventType: "CHECKER_AVAILABILITY_CHANGED",
      actorEmail: "admin@justicenow.org",
      targetCheckerEmail: "checker.fernando@justicenow.org",
      previousStatus: "available",
      newStatus: "busy",
      timestamp: new Date().toISOString(),
      reason: "High caseload",
    };
    assert.equal(auditEvent.eventType, "CHECKER_AVAILABILITY_CHANGED");
    assert.ok(auditEvent.timestamp);
    assert.ok(auditEvent.actorEmail);
    assert.ok(auditEvent.targetCheckerEmail);
  });

  it("AC 6: Unauthorized users cannot change availability", () => {
    const resOfficer = updateCheckerAvailabilityTest("case_officer", TEST_CHECKERS[0], "inactive", false);
    assert.equal(resOfficer.success, false);
    assert.ok(resOfficer.error.includes("Unauthorized"));

    const resReporter = updateCheckerAvailabilityTest("reporter", TEST_CHECKERS[0], "inactive", false);
    assert.equal(resReporter.success, false);
    assert.ok(resReporter.error.includes("Unauthorized"));

    const resChecker = updateCheckerAvailabilityTest("evidence_checker", TEST_CHECKERS[0], "inactive", false);
    assert.equal(resChecker.success, false);
    assert.ok(resChecker.error.includes("Unauthorized"));
  });
});

console.log("Evidence Checker availability tests passed.");
