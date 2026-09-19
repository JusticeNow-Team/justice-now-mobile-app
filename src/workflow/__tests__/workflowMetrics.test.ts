import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  getWorkflowDashboardMetrics,
  getCaseStatusBreakdown,
  getEvidenceStatusBreakdown,
  detectWorkflowDelays,
  requireAdministrator,
  isCaseActive,
  isCaseAwaitingInitialReview,
  isEvidenceAwaitingVerification,
  isEvidenceVerificationCompleted,
  resetWorkflowStoreForTesting,
  setEmptyWorkflowStoreForTesting,
  INITIAL_MOCK_WORKFLOW_CASES,
  INITIAL_MOCK_WORKFLOW_EVIDENCE,
} from "../index";
import { WorkflowCaseItem } from "../types";

describe("Sprint 3: Monitor Workflow Activity (JN-287 to JN-292)", () => {
  beforeEach(() => {
    resetWorkflowStoreForTesting();
  });

  // ==========================================================================
  // AC 1 & JN-287: Total Active Cases
  // ==========================================================================
  describe("AC 1 & JN-287: Total Active Cases Metric", () => {
    it("AC 1: Accurately counts non-terminal active cases", async () => {
      const metrics = await getWorkflowDashboardMetrics({}, "system_admin");

      // In initial mock: submitted(1), under_review(1), investigating(1), awaiting_information(1), action_taken(1) = 5
      // Terminal: resolved(1), dismissed(1), withdrawn(1) = 3
      // Total = 8
      assert.equal(metrics.totalActiveCases, 5, "Total active cases must equal 5");
      assert.equal(metrics.totalCasesCount, 8, "Total cases count must equal 8");
    });

    it("AC 1: isCaseActive helper identifies non-terminal vs terminal statuses", () => {
      assert.equal(isCaseActive("submitted"), true);
      assert.equal(isCaseActive("under_review"), true);
      assert.equal(isCaseActive("investigating"), true);
      assert.equal(isCaseActive("awaiting_information"), true);
      assert.equal(isCaseActive("action_taken"), true);

      assert.equal(isCaseActive("resolved"), false);
      assert.equal(isCaseActive("dismissed"), false);
      assert.equal(isCaseActive("withdrawn"), false);
      assert.equal(isCaseActive("closed"), false);
    });
  });

  // ==========================================================================
  // AC 2 & JN-287: Cases Awaiting Initial Review
  // ==========================================================================
  describe("AC 2 & JN-287: Cases Awaiting Initial Review Metric", () => {
    it("AC 2: Accurately counts cases in submitted and under_review intake stages", async () => {
      const metrics = await getWorkflowDashboardMetrics({}, "system_admin");

      // In initial mock: submitted (CASE-2026-0801), under_review (CASE-2026-0802) = 2
      assert.equal(metrics.casesAwaitingInitialReview, 2);
    });

    it("AC 2: isCaseAwaitingInitialReview helper checks intake queue accurately", () => {
      assert.equal(isCaseAwaitingInitialReview("submitted"), true);
      assert.equal(isCaseAwaitingInitialReview("under_review"), true);
      assert.equal(isCaseAwaitingInitialReview("investigating"), false);
      assert.equal(isCaseAwaitingInitialReview("resolved"), false);
    });
  });

  // ==========================================================================
  // AC 3 & JN-287: Evidence Awaiting Verification
  // ==========================================================================
  describe("AC 3 & JN-287: Evidence Awaiting Verification Metric", () => {
    it("AC 3: Accurately counts unverified evidence in pending and under_review statuses", async () => {
      const metrics = await getWorkflowDashboardMetrics({}, "system_admin");

      // In initial mock: pending (EVD-2026-9001), under_review (EVD-2026-9002) = 2
      assert.equal(metrics.evidenceAwaitingVerification, 2);
    });

    it("AC 3: isEvidenceAwaitingVerification helper accurately filters queue states", () => {
      assert.equal(isEvidenceAwaitingVerification("pending"), true);
      assert.equal(isEvidenceAwaitingVerification("under_review"), true);
      assert.equal(isEvidenceAwaitingVerification("approved"), false);
      assert.equal(isEvidenceAwaitingVerification("validated"), false);
      assert.equal(isEvidenceAwaitingVerification("rejected"), false);
    });
  });

  // ==========================================================================
  // AC 4 & JN-287: Completed Verification Count
  // ==========================================================================
  describe("AC 4 & JN-287: Completed Verification Count Metric", () => {
    it("AC 4: Accurately counts completed verifications (approved, validated, rejected)", async () => {
      const metrics = await getWorkflowDashboardMetrics({}, "system_admin");

      // In initial mock: approved (EVD-2026-9003), validated (EVD-2026-9004), rejected (EVD-2026-9005) = 3
      assert.equal(metrics.completedVerificationCount, 3);
    });

    it("AC 4: isEvidenceVerificationCompleted helper identifies finished reviews", () => {
      assert.equal(isEvidenceVerificationCompleted("approved"), true);
      assert.equal(isEvidenceVerificationCompleted("validated"), true);
      assert.equal(isEvidenceVerificationCompleted("rejected"), true);
      assert.equal(isEvidenceVerificationCompleted("pending"), false);
      assert.equal(isEvidenceVerificationCompleted("under_review"), false);
    });
  });

  // ==========================================================================
  // AC 5 & JN-288 & JN-292: Figures Based on Current System Data
  // ==========================================================================
  describe("AC 5 & JN-288 & JN-292: Dynamic Current Data & Metric Accuracy", () => {
    it("AC 5: Dynamically updates figures when new cases or evidence items are added", async () => {
      const customCases: WorkflowCaseItem[] = [
        ...INITIAL_MOCK_WORKFLOW_CASES,
        {
          id: "CASE-NEW-999",
          caseReference: "JN-2026-0999",
          title: "New Incident Report",
          status: "submitted",
          priority: "urgent",
          category: "Civil Rights",
          submittedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          evidenceCount: 1,
        },
      ];

      resetWorkflowStoreForTesting(customCases);

      const metrics = await getWorkflowDashboardMetrics({}, "system_admin");
      assert.equal(metrics.totalActiveCases, 6, "Total active cases should increment to 6");
      assert.equal(metrics.casesAwaitingInitialReview, 3, "Awaiting review should increment to 3");
      assert.equal(metrics.totalCasesCount, 9);
      assert.ok(metrics.computedAt);
      assert.ok(!Number.isNaN(Date.parse(metrics.computedAt)));
    });
  });

  // ==========================================================================
  // AC 6 & JN-289: Administrative Authorization Guard
  // ==========================================================================
  describe("AC 6 & JN-289: Admin-Only Dashboard Security", () => {
    it("AC 6: Allows authorized System Admin to view workflow metrics", async () => {
      const res = await getWorkflowDashboardMetrics({}, "system_admin");
      assert.ok(res);
      assert.equal(typeof res.totalActiveCases, "number");
    });

    it("AC 6: Rejects Case Officer with unauthorized error", async () => {
      await assert.rejects(
        async () => {
          await getWorkflowDashboardMetrics({}, "case_officer");
        },
        /Unauthorized.*Workflow Activity Dashboard/i,
      );
    });

    it("AC 6: Rejects Evidence Checker with unauthorized error", async () => {
      await assert.rejects(
        async () => {
          await getWorkflowDashboardMetrics({}, "evidence_checker");
        },
        /Unauthorized.*Workflow Activity Dashboard/i,
      );
    });

    it("AC 6: Rejects Reporter with unauthorized error", async () => {
      await assert.rejects(
        async () => {
          await getWorkflowDashboardMetrics({}, "reporter");
        },
        /Unauthorized.*Workflow Activity Dashboard/i,
      );
    });

    it("AC 6: Rejects unauthenticated / anonymous user with unauthorized error", async () => {
      await assert.rejects(
        async () => {
          await getWorkflowDashboardMetrics({}, undefined);
        },
        /Unauthorized.*Workflow Activity Dashboard/i,
      );
    });

    it("AC 6: requireAdministrator helper validates system_admin strictly", () => {
      assert.doesNotThrow(() => requireAdministrator("system_admin"));
      assert.throws(() => requireAdministrator("case_officer"), /Unauthorized/);
      assert.throws(() => requireAdministrator("evidence_checker"), /Unauthorized/);
      assert.throws(() => requireAdministrator("reporter"), /Unauthorized/);
      assert.throws(() => requireAdministrator(undefined), /Unauthorized/);
    });
  });

  // ==========================================================================
  // AC 7 & JN-291: Empty Data State Handling
  // ==========================================================================
  describe("AC 7 & JN-291: Empty Data State Handling", () => {
    it("AC 7: Gracefully handles empty case and evidence datasets with 0 counts", async () => {
      setEmptyWorkflowStoreForTesting();

      const metrics = await getWorkflowDashboardMetrics({}, "system_admin");

      assert.equal(metrics.totalActiveCases, 0);
      assert.equal(metrics.casesAwaitingInitialReview, 0);
      assert.equal(metrics.evidenceAwaitingVerification, 0);
      assert.equal(metrics.completedVerificationCount, 0);
      assert.equal(metrics.totalCasesCount, 0);
      assert.equal(metrics.totalEvidenceCount, 0);
      assert.equal(metrics.delayAlerts.length, 0);

      // Status breakdown arrays should contain all configured statuses with 0 count and 0%
      assert.ok(metrics.caseStatusBreakdown.length > 0);
      assert.ok(metrics.caseStatusBreakdown.every((item) => item.count === 0 && item.percentage === 0));

      assert.ok(metrics.evidenceStatusBreakdown.length > 0);
      assert.ok(metrics.evidenceStatusBreakdown.every((item) => item.count === 0 && item.percentage === 0));
    });
  });

  // ==========================================================================
  // JN-290: Status Summary Cards Breakdown
  // ==========================================================================
  describe("JN-290: Status Summary Cards Breakdown", () => {
    it("JN-290: Generates complete case status pipeline distribution", () => {
      const breakdown = getCaseStatusBreakdown(INITIAL_MOCK_WORKFLOW_CASES);
      assert.ok(breakdown.length >= 8);

      const submitted = breakdown.find((b) => b.status === "submitted");
      assert.ok(submitted);
      assert.equal(submitted.count, 1);
      assert.equal(submitted.percentage, Math.round((1 / 8) * 100));

      const investigating = breakdown.find((b) => b.status === "investigating");
      assert.ok(investigating);
      assert.equal(investigating.count, 1);
      assert.equal(investigating.isActiveWorkflow, true);
    });

    it("JN-290: Generates complete evidence verification pipeline distribution", () => {
      const breakdown = getEvidenceStatusBreakdown(INITIAL_MOCK_WORKFLOW_EVIDENCE);
      assert.ok(breakdown.length >= 8);

      const approved = breakdown.find((b) => b.status === "approved");
      assert.ok(approved);
      assert.equal(approved.count, 1);
      assert.equal(approved.isCompleted, true);

      const pending = breakdown.find((b) => b.status === "pending");
      assert.ok(pending);
      assert.equal(pending.count, 1);
      assert.equal(pending.isAwaitingVerification, true);
    });
  });

  // ==========================================================================
  // JN-292: Delay Detection & Bottleneck Alerts
  // ==========================================================================
  describe("JN-292: Delay Detection & Bottleneck Alerts", () => {
    it("JN-292: Detects case intake delays exceeding 48 hours", () => {
      const fixedNow = "2026-09-19T12:00:00.000Z";
      const alerts = detectWorkflowDelays(
        INITIAL_MOCK_WORKFLOW_CASES,
        INITIAL_MOCK_WORKFLOW_EVIDENCE,
        fixedNow,
      );

      const caseAlerts = alerts.filter((a) => a.itemType === "case");
      assert.ok(caseAlerts.length >= 2, "Should detect at least 2 case intake delays");

      // CASE-2026-0801 submitted 2026-09-15 (>96h) should be critical
      const critCase = caseAlerts.find((a) => a.reference === "JN-2026-0801");
      assert.ok(critCase);
      assert.equal(critCase.severity, "critical");
      assert.ok(critCase.durationHours >= 96);

      // CASE-2026-0802 submitted 2026-09-16 (~73h) should be warning
      const warnCase = caseAlerts.find((a) => a.reference === "JN-2026-0802");
      assert.ok(warnCase);
      assert.equal(warnCase.severity, "warning");
      assert.ok(warnCase.durationHours >= 48);
    });

    it("JN-292: Detects evidence review delays exceeding 72 hours", () => {
      const fixedNow = "2026-09-19T12:00:00.000Z";
      const alerts = detectWorkflowDelays(
        INITIAL_MOCK_WORKFLOW_CASES,
        INITIAL_MOCK_WORKFLOW_EVIDENCE,
        fixedNow,
      );

      const evAlerts = alerts.filter((a) => a.itemType === "evidence");
      assert.ok(evAlerts.length >= 2, "Should detect at least 2 evidence review delays");

      // EVD-2026-9001 uploaded 2026-09-14 (>120h) should be critical
      const critEv = evAlerts.find((a) => a.id === "delay_ev_EVD-2026-9001");
      assert.ok(critEv);
      assert.equal(critEv.severity, "critical");
      assert.ok(critEv.durationHours >= 120);
    });
  });
});
