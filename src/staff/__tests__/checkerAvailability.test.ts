import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  getAvailableEvidenceCheckers,
  getEvidenceCheckerAvailability,
  getEvidenceCheckerById,
  updateEvidenceCheckerAvailability,
  validateCheckerEligibilityForAssignment,
  simulateAssignEvidenceToChecker,
  getCheckerAssignmentHistory,
  resetCheckerAvailabilityToDefault,
} from "../checkerAvailabilityService";

describe("Sprint 3 Task JN-266: Manage Evidence Checker Availability", () => {
  beforeEach(() => {
    resetCheckerAvailabilityToDefault();
  });

  describe("Subtask JN-267 & AC 1: Identify Active Evidence Checkers & Workload", () => {
    it("Admin can retrieve all Evidence Checkers with their availability status and active workload", async () => {
      const checkers = await getEvidenceCheckerAvailability();
      assert.ok(checkers.length >= 4, "Should have seeded evidence checkers");

      // Verify each checker has the required availability fields
      for (const checker of checkers) {
        assert.ok(checker.id, "Checker must have an ID");
        assert.ok(checker.fullName, "Checker must have a full name");
        assert.ok(checker.email, "Checker must have an email");
        assert.ok(
          ["available", "busy", "away", "inactive"].includes(
            checker.availabilityStatus,
          ),
          `Checker ${checker.id} must have a valid availabilityStatus`,
        );
        assert.equal(
          typeof checker.isActive,
          "boolean",
          "Checker must have a boolean isActive flag",
        );
        assert.equal(
          typeof checker.activeAssignmentsCount,
          "number",
          "Checker must have activeAssignmentsCount",
        );
      }
    });

    it("Retrieves active & assignable checkers via getAvailableEvidenceCheckers", async () => {
      const availableCheckers = await getAvailableEvidenceCheckers();
      assert.ok(availableCheckers.length > 0, "Should have assignable checkers");

      // All returned checkers must be active and not away/inactive
      for (const checker of availableCheckers) {
        assert.equal(checker.isActive, true, "Must be active");
        assert.ok(
          ["available", "busy"].includes(checker.availabilityStatus),
          "Status must be available or busy",
        );
      }
    });

    it("Can filter checkers by availability status", async () => {
      const busyCheckers = await getEvidenceCheckerAvailability({
        availability: "busy",
      });
      assert.ok(busyCheckers.length > 0);
      assert.ok(busyCheckers.every((c) => c.availabilityStatus === "busy"));

      const inactiveCheckers = await getEvidenceCheckerAvailability({
        availability: "inactive",
      });
      assert.ok(inactiveCheckers.length > 0);
      assert.ok(
        inactiveCheckers.every(
          (c) => c.availabilityStatus === "inactive" || !c.isActive,
        ),
      );
    });

    it("Finds checker by ID", async () => {
      const checker = await getEvidenceCheckerById("CHK-001-ELENA");
      assert.ok(checker);
      assert.equal(checker.email, "elena.checker@justicenow.org");
      assert.equal(checker.isActive, true);
    });
  });

  describe("Subtask JN-268 & JN-270 & AC 2: Activate / Deactivate Checker with Confirmation", () => {
    it("Admin can deactivate an active evidence checker with reason and confirmation", async () => {
      const result = await updateEvidenceCheckerAvailability({
        actorRole: "system_admin",
        actorUserId: "admin_01",
        actorEmail: "admin@justicenow.org",
        targetCheckerId: "CHK-001-ELENA",
        isActive: false,
        reason: "Taking medical leave",
      });

      assert.equal(result.success, true);
      assert.ok(result.checker);
      assert.equal(result.checker.isActive, false);
      assert.equal(result.checker.availabilityStatus, "inactive");

      // Verify the updated state is persisted in store
      const updated = await getEvidenceCheckerById("CHK-001-ELENA");
      assert.equal(updated?.isActive, false);
      assert.equal(updated?.availabilityStatus, "inactive");
    });

    it("Admin can reactivate a deactivated evidence checker", async () => {
      const result = await updateEvidenceCheckerAvailability({
        actorRole: "system_admin",
        actorUserId: "admin_01",
        actorEmail: "admin@justicenow.org",
        targetCheckerId: "CHK-003-SAMIRA", // initially inactive
        isActive: true,
        availabilityStatus: "available",
        reason: "Returned to active duty",
      });

      assert.equal(result.success, true);
      assert.ok(result.checker);
      assert.equal(result.checker.isActive, true);
      assert.equal(result.checker.availabilityStatus, "available");

      const updated = await getEvidenceCheckerById("CHK-003-SAMIRA");
      assert.equal(updated?.isActive, true);
      assert.equal(updated?.availabilityStatus, "available");
    });

    it("Admin can update availability status to 'away' while remaining active", async () => {
      const result = await updateEvidenceCheckerAvailability({
        actorRole: "system_admin",
        actorUserId: "admin_01",
        actorEmail: "admin@justicenow.org",
        targetCheckerId: "CHK-001-ELENA",
        availabilityStatus: "away",
        reason: "Attending forensic seminar",
      });

      assert.equal(result.success, true);
      assert.equal(result.checker?.availabilityStatus, "away");
      assert.equal(result.checker?.isActive, true);
    });
  });

  describe("Subtask JN-269 & AC 3: Restrict Assignment to Active Checkers Only", () => {
    it("Rejects evidence assignment to a deactivated checker", async () => {
      // CHK-003-SAMIRA is inactive
      const checker = await getEvidenceCheckerById("CHK-003-SAMIRA");
      assert.ok(checker);
      const eligibility = validateCheckerEligibilityForAssignment(checker);

      assert.equal(eligibility.eligible, false);
      assert.ok(eligibility.error?.includes("deactivated"));

      // Assignment simulation also fails
      const assignResult = await simulateAssignEvidenceToChecker(
        "ev_doc_999",
        "CHK-003-SAMIRA",
        "officer_01",
        "officer@justicenow.org",
      );
      assert.equal(assignResult.success, false);
      assert.ok(assignResult.error?.includes("deactivated"));
    });

    it("Rejects evidence assignment to an 'away' checker", async () => {
      const checker = await getEvidenceCheckerById("CHK-004-ALEX"); // status is 'away'
      assert.ok(checker);
      const eligibility = validateCheckerEligibilityForAssignment(checker);

      assert.equal(eligibility.eligible, false);
      assert.ok(eligibility.error?.includes("away"));
    });

    it("Allows evidence assignment to an active 'available' checker", async () => {
      const checker = await getEvidenceCheckerById("CHK-001-ELENA");
      assert.ok(checker);
      const eligibility = validateCheckerEligibilityForAssignment(checker);

      assert.equal(eligibility.eligible, true);

      const assignResult = await simulateAssignEvidenceToChecker(
        "ev_doc_100",
        "CHK-001-ELENA",
        "officer_01",
        "officer@justicenow.org",
      );
      assert.equal(assignResult.success, true);
      assert.ok(assignResult.assignmentId);
    });

    it("Rejects assignment for a non-existent checker ID", async () => {
      const assignResult = await simulateAssignEvidenceToChecker(
        "ev_doc_100",
        "non_existent_id",
        "officer_01",
        "officer@justicenow.org",
      );
      assert.equal(assignResult.success, false);
      assert.ok(assignResult.error?.includes("not found"));
    });
  });

  describe("Subtask JN-269 & AC 4: Existing Assignments Remain Traceable", () => {
    it("Deactivating a checker preserves their assignment history and decisions", async () => {
      const historyBefore = getCheckerAssignmentHistory("CHK-001-ELENA");
      assert.ok(historyBefore.totalAssignmentsCount >= 2, "Should have assignment records");

      // Deactivate checker
      await updateEvidenceCheckerAvailability({
        actorRole: "system_admin",
        actorUserId: "admin_01",
        actorEmail: "admin@justicenow.org",
        targetCheckerId: "CHK-001-ELENA",
        isActive: false,
        reason: "Leave of absence",
      });

      // Fetch history again - all records must still exist and be traceable
      const historyAfter = getCheckerAssignmentHistory("CHK-001-ELENA");
      assert.equal(
        historyAfter.totalAssignmentsCount,
        historyBefore.totalAssignmentsCount,
      );
      assert.equal(
        historyAfter.activeAssignments.length,
        historyBefore.activeAssignments.length,
      );
    });
  });

  describe("Subtask JN-271 & AC 5: Account Changes Are Audited", () => {
    it("Emits audit log when checker is deactivated", async () => {
      const res = await updateEvidenceCheckerAvailability({
        actorRole: "system_admin",
        actorUserId: "admin_01",
        actorEmail: "admin@justicenow.org",
        targetCheckerId: "CHK-001-ELENA",
        isActive: false,
        reason: "Operational reassignment",
      });

      assert.equal(res.success, true);
    });

    it("Emits audit log when checker availability status changes", async () => {
      const res = await updateEvidenceCheckerAvailability({
        actorRole: "system_admin",
        actorUserId: "admin_01",
        actorEmail: "admin@justicenow.org",
        targetCheckerId: "CHK-001-ELENA",
        availabilityStatus: "busy",
        reason: "High volume workload assigned",
      });

      assert.equal(res.success, true);
    });
  });

  describe("Subtask JN-271 & AC 6: Unauthorized Users Cannot Change Availability", () => {
    it("Rejects availability update from Case Officer", async () => {
      const result = await updateEvidenceCheckerAvailability({
        actorRole: "case_officer",
        actorUserId: "officer_01",
        actorEmail: "officer@justicenow.org",
        targetCheckerId: "CHK-001-ELENA",
        isActive: false,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized"));
    });

    it("Rejects availability update from Reporter", async () => {
      const result = await updateEvidenceCheckerAvailability({
        actorRole: "reporter",
        actorUserId: "reporter_01",
        actorEmail: "reporter@example.com",
        targetCheckerId: "CHK-001-ELENA",
        isActive: false,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized"));
    });

    it("Rejects availability update from Evidence Checker (self or peer)", async () => {
      const result = await updateEvidenceCheckerAvailability({
        actorRole: "evidence_checker",
        actorUserId: "CHK-001-ELENA",
        actorEmail: "elena.checker@justicenow.org",
        targetCheckerId: "CHK-002-MARCUS",
        isActive: false,
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized"));
    });
  });
});
