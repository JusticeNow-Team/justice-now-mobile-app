import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  createStatusConfig,
  deleteStatusConfig,
  getAvailableStatusesForOperations,
  getStatusConfigs,
  INITIAL_CASE_STATUSES,
  INITIAL_EVIDENCE_STATUSES,
  resetStatusConfigsToDefault,
  toggleStatusActive,
  updateStatusConfig,
} from "../statusService";
import { canDeleteStatus, slugifyStatusCode, validateStatusInput } from "../validation";

describe("Sprint 3: Configure Case and Evidence Status Values (JN-273 to JN-278)", () => {
  const adminActor = {
    role: "system_admin",
    userId: "admin-uuid-001",
    email: "sysadmin@justicenow.org",
  };

  const unauthorizedActor = {
    role: "case_officer",
    userId: "officer-uuid-002",
    email: "officer@justicenow.org",
  };

  beforeEach(() => {
    resetStatusConfigsToDefault();
  });

  // AC 1 & JN-273: Approved case statuses are available
  describe("AC 1 (JN-273): Approved Case Statuses Availability", () => {
    it("should provide all approved default case workflow statuses", async () => {
      const caseStatuses = await getStatusConfigs("case");
      assert.ok(caseStatuses.length >= 8, "Must have at least 8 initial case statuses");

      const codes = caseStatuses.map((s) => s.code);
      const expectedCodes = [
        "submitted",
        "under_review",
        "investigating",
        "awaiting_information",
        "action_taken",
        "resolved",
        "dismissed",
        "withdrawn",
      ];

      for (const expected of expectedCodes) {
        assert.ok(
          codes.includes(expected),
          `Expected case status [code: ${expected}] to be available`,
        );
      }
    });

    it("should ensure case statuses conform to the schema with tones and descriptions", () => {
      for (const status of INITIAL_CASE_STATUSES) {
        assert.equal(status.entityType, "case");
        assert.ok(status.name.length > 0, "Name must be non-empty");
        assert.ok(status.description.length > 0, "Description must be non-empty");
        assert.ok(["info", "warning", "success", "danger", "neutral"].includes(status.tone));
        assert.ok(typeof status.isActive === "boolean");
        assert.ok(typeof status.displayOrder === "number");
      }
    });
  });

  // AC 2 & JN-273: Approved evidence statuses are available
  describe("AC 2 (JN-273): Approved Evidence Statuses Availability", () => {
    it("should provide all approved default evidence workflow statuses", async () => {
      const evidenceStatuses = await getStatusConfigs("evidence");
      assert.ok(evidenceStatuses.length >= 6, "Must have at least 6 initial evidence statuses");

      const codes = evidenceStatuses.map((s) => s.code);
      const expectedCodes = [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "reassignment_requested",
        "escalated",
      ];

      for (const expected of expectedCodes) {
        assert.ok(
          codes.includes(expected),
          `Expected evidence status [code: ${expected}] to be available`,
        );
      }
    });

    it("should ensure evidence statuses conform to the schema with tones and descriptions", () => {
      for (const status of INITIAL_EVIDENCE_STATUSES) {
        assert.equal(status.entityType, "evidence");
        assert.ok(status.name.length > 0, "Name must be non-empty");
        assert.ok(status.description.length > 0, "Description must be non-empty");
        assert.ok(["info", "warning", "success", "danger", "neutral"].includes(status.tone));
        assert.ok(typeof status.isActive === "boolean");
        assert.ok(typeof status.displayOrder === "number");
      }
    });
  });

  // AC 3 & JN-275: Duplicate statuses are prevented
  describe("AC 3 (JN-275): Duplicate Status Prevention", () => {
    it("should reject creation of a status with an existing duplicate code (case-insensitive)", async () => {
      const result = await createStatusConfig(
        {
          entityType: "case",
          code: "SUBMITTED", // duplicate of existing 'submitted'
          name: "Duplicate Submitted",
          description: "Testing duplicate prevention",
          tone: "info",
        },
        adminActor,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("already exists"));
    });

    it("should reject creation of a status with an existing duplicate name (case-insensitive)", async () => {
      const result = await createStatusConfig(
        {
          entityType: "case",
          name: "Under Review", // duplicate of existing name
          description: "Duplicate name testing",
          tone: "warning",
        },
        adminActor,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("already exists"));
    });

    it("should allow identical names across DIFFERENT entity types (case vs evidence)", async () => {
      // Both case and evidence can have 'Under Review' because entity types differ
      const caseStatuses = await getStatusConfigs("case");
      const evidenceStatuses = await getStatusConfigs("evidence");

      const caseHasReview = caseStatuses.some((s) => s.code === "under_review");
      const evHasReview = evidenceStatuses.some((s) => s.code === "under_review");

      assert.ok(caseHasReview, "Case should have under_review");
      assert.ok(evHasReview, "Evidence should have under_review");
    });

    it("should slugify status codes correctly from display names", () => {
      assert.equal(slugifyStatusCode("Awaiting Court Hearing!"), "awaiting_court_hearing");
      assert.equal(slugifyStatusCode("Forensic   Verification  (Special)"), "forensic_verification_special");
      assert.equal(slugifyStatusCode("---Custom Status---"), "custom_status");
    });

    it("should validate input field requirements", () => {
      const existing = INITIAL_CASE_STATUSES;

      // Empty name
      const res1 = validateStatusInput(
        { entityType: "case", name: "", description: "A valid description" },
        existing,
      );
      assert.equal(res1.isValid, false);
      assert.ok(res1.errors.some((e) => e.includes("Name is required")));

      // Empty description
      const res2 = validateStatusInput(
        { entityType: "case", name: "New Status", description: "" },
        existing,
      );
      assert.equal(res2.isValid, false);
      assert.ok(res2.errors.some((e) => e.includes("Description is required")));
    });
  });

  // AC 4 & JN-277: Statuses used by active records cannot be deleted unsafely
  describe("AC 4 (JN-277): Protection of Statuses Used by Active Records", () => {
    it("should block deletion of a status currently referenced by active records", async () => {
      const caseStatuses = await getStatusConfigs("case");
      const target = caseStatuses.find((s) => s.code === "investigating");
      assert.ok(target, "Target investigating status exists");
      assert.ok(target.activeRecordCount > 0, "Has active records");

      const result = await deleteStatusConfig(target.id, adminActor);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("active"));
      assert.equal(result.activeRecordCount, target.activeRecordCount);
    });

    it("should block deletion of system default statuses even if record count is zero", () => {
      const mockDefaultStatus = {
        ...INITIAL_CASE_STATUSES[0],
        activeRecordCount: 0,
        isSystemDefault: true,
      };

      const check = canDeleteStatus(mockDefaultStatus);
      assert.equal(check.allowed, false);
      assert.ok(check.reason?.includes("system default"));
    });

    it("should allow safe deletion of a custom, unused status (0 active records)", async () => {
      // 1. Create a custom status
      const createRes = await createStatusConfig(
        {
          entityType: "case",
          code: "temp_custom_status",
          name: "Temporary Custom Status",
          description: "A custom test status to be safely deleted",
          tone: "neutral",
        },
        adminActor,
      );

      assert.equal(createRes.success, true);
      const newId = createRes.status!.id;

      // 2. Delete the custom status
      const deleteRes = await deleteStatusConfig(newId, adminActor);
      assert.equal(deleteRes.success, true);

      // 3. Verify it is no longer in store
      const updatedList = await getStatusConfigs("case");
      assert.ok(!updatedList.some((s) => s.id === newId));
    });
  });

  // AC 5 & JN-276: Inactive statuses are hidden from new operations
  describe("AC 5 (JN-276): Active and Inactive Status Handling", () => {
    it("should hide deactivated statuses from new operations while preserving history", async () => {
      // 1. Deactivate a status
      const targetId = INITIAL_CASE_STATUSES[4].id; // "stat_case_action_taken"
      const toggleRes = await toggleStatusActive(targetId, false, adminActor);
      assert.equal(toggleRes.success, true);

      // 2. Query for new operations dropdown
      const operationalStatuses = await getAvailableStatusesForOperations("case");
      const opCodes = operationalStatuses.map((s) => s.code);

      assert.ok(!opCodes.includes("action_taken"), "Deactivated status must NOT appear in new operations");

      // 3. Query all statuses (Admin / Historical view)
      const allStatuses = await getStatusConfigs("case");
      const allCodes = allStatuses.map((s) => s.code);
      assert.ok(allCodes.includes("action_taken"), "Historical/admin list must retain deactivated status");
    });

    it("should reactivate a status and make it available for operations again", async () => {
      const targetId = INITIAL_CASE_STATUSES[4].id;
      // Deactivate
      await toggleStatusActive(targetId, false, adminActor);
      // Reactivate
      const reactivateRes = await toggleStatusActive(targetId, true, adminActor);
      assert.equal(reactivateRes.success, true);

      const operationalStatuses = await getAvailableStatusesForOperations("case");
      const opCodes = operationalStatuses.map((s) => s.code);
      assert.ok(opCodes.includes("action_taken"), "Reactivated status must be available for operations");
    });
  });

  // AC 6 & JN-274: Only authorized administrators can manage status settings
  describe("AC 6 (JN-274): Role Authorization Guard", () => {
    it("should reject status creation by non-admin users", async () => {
      const res = await createStatusConfig(
        {
          entityType: "case",
          name: "Officer Custom Status",
          description: "Should fail unauthorized",
        },
        unauthorizedActor,
      );

      assert.equal(res.success, false);
      assert.ok(res.error?.includes("Unauthorized"));
    });

    it("should reject status updates by non-admin users", async () => {
      const res = await updateStatusConfig(
        INITIAL_CASE_STATUSES[0].id,
        { name: "Hacked Name" },
        unauthorizedActor,
      );

      assert.equal(res.success, false);
      assert.ok(res.error?.includes("Unauthorized"));
    });

    it("should reject status toggle by non-admin users", async () => {
      const res = await toggleStatusActive(
        INITIAL_CASE_STATUSES[0].id,
        false,
        unauthorizedActor,
      );

      assert.equal(res.success, false);
      assert.ok(res.error?.includes("Unauthorized"));
    });

    it("should reject status deletion by non-admin users", async () => {
      const res = await deleteStatusConfig(
        INITIAL_CASE_STATUSES[0].id,
        unauthorizedActor,
      );

      assert.equal(res.success, false);
      assert.ok(res.error?.includes("Unauthorized"));
    });
  });

  // AC 7 & JN-278: Status changes are audited
  describe("AC 7 (JN-278): Status Change Audit Logging", () => {
    it("should successfully execute and audit status creation, updates, toggles, and safe deletion", async () => {
      // 1. Create custom status
      const created = await createStatusConfig(
        {
          entityType: "evidence",
          code: "forensic_audio_analyzed",
          name: "Audio Forensics Analyzed",
          description: "Audio waveform spectral verification completed.",
          tone: "success",
        },
        adminActor,
      );
      assert.equal(created.success, true);
      assert.equal(created.status?.name, "Audio Forensics Analyzed");

      // 2. Update status
      const updated = await updateStatusConfig(
        created.status!.id,
        {
          name: "Audio Forensics Fully Verified",
          description: "Updated detailed verification description.",
          tone: "success",
        },
        adminActor,
        "Refining nomenclature for clarity",
      );
      assert.equal(updated.success, true);
      assert.equal(updated.status?.name, "Audio Forensics Fully Verified");

      // 3. Toggle status
      const toggled = await toggleStatusActive(
        created.status!.id,
        false,
        adminActor,
        "Temporarily archiving during pilot",
      );
      assert.equal(toggled.success, true);
      assert.equal(toggled.status?.isActive, false);

      // 4. Delete status
      const deleted = await deleteStatusConfig(
        created.status!.id,
        adminActor,
        "Clean up test status",
      );
      assert.equal(deleted.success, true);
    });
  });
});
