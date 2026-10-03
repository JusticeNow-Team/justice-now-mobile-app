import {
  calculateCaseStatistics,
  calculateEvidenceStatistics,
  calculateUserStatistics,
  calculateWorkloadMetrics,
  getSystemStatistics,
  requireAdministrator,
  resetStatisticsStoreForTesting,
  setEmptyStatisticsStoreForTesting,
} from "../statisticsService";
import {
  INITIAL_MOCK_CASES,
  INITIAL_MOCK_EVIDENCE,
  INITIAL_MOCK_USERS,
} from "../seeds/statisticsSeed";

describe("System Statistics Service & Aggregation Engine (JN-386 to JN-391)", () => {
  beforeEach(() => {
    resetStatisticsStoreForTesting();
  });

  describe("AC 1 & AC 2: User Statistics & Role Breakdown", () => {
    it("computes total users, active users, and inactive users accurately", () => {
      const stats = calculateUserStatistics(INITIAL_MOCK_USERS);

      expect(stats.totalUsers).toBe(13);
      expect(stats.activeUsers).toBe(10);
      expect(stats.inactiveUsers).toBe(3);
    });

    it("breaks down users across all 4 system roles correctly with percentages", () => {
      const stats = calculateUserStatistics(INITIAL_MOCK_USERS);

      expect(stats.systemAdminsCount).toBe(2);
      expect(stats.caseOfficersCount).toBe(3);
      expect(stats.evidenceCheckersCount).toBe(3);
      expect(stats.reportersCount).toBe(5);

      const adminRole = stats.rolesBreakdown.find((r) => r.role === "system_admin");
      expect(adminRole).toBeDefined();
      expect(adminRole?.count).toBe(2);
      expect(adminRole?.activeCount).toBe(2);
      expect(adminRole?.percentage).toBe(15);

      const officerRole = stats.rolesBreakdown.find((r) => r.role === "case_officer");
      expect(officerRole).toBeDefined();
      expect(officerRole?.count).toBe(3);
      expect(officerRole?.activeCount).toBe(2);
      expect(officerRole?.inactiveCount).toBe(1);

      const reporterRole = stats.rolesBreakdown.find((r) => r.role === "reporter");
      expect(reporterRole).toBeDefined();
      expect(reporterRole?.count).toBe(5);
      expect(reporterRole?.activeCount).toBe(4);
      expect(reporterRole?.inactiveCount).toBe(1);
    });
  });

  describe("AC 3: Cases by Status Breakdown", () => {
    it("computes total cases, active pipeline cases, and status distribution", () => {
      const stats = calculateCaseStatistics(INITIAL_MOCK_CASES);

      expect(stats.totalCases).toBe(8);
      // submitted (1) + under_review (1) + investigating (1) + awaiting_info (1) + action_taken (1) = 5 active
      expect(stats.activeCases).toBe(5);
      expect(stats.resolvedCases).toBe(1);
      expect(stats.awaitingReviewCases).toBe(2); // submitted (1) + under_review (1)
      expect(stats.investigatingCases).toBe(1);

      const submittedStatus = stats.statusBreakdown.find((s) => s.status === "submitted");
      expect(submittedStatus?.count).toBe(1);
      expect(submittedStatus?.isActiveStage).toBe(true);

      const resolvedStatus = stats.statusBreakdown.find((s) => s.status === "resolved");
      expect(resolvedStatus?.count).toBe(1);
      expect(resolvedStatus?.isActiveStage).toBe(false);

      const withdrawnStatus = stats.statusBreakdown.find((s) => s.status === "withdrawn");
      expect(withdrawnStatus?.count).toBe(1);
    });
  });

  describe("AC 4: Cases by Category Breakdown", () => {
    it("groups cases into categories with count, active count, and percentage share", () => {
      const stats = calculateCaseStatistics(INITIAL_MOCK_CASES);

      expect(stats.categoryBreakdown.length).toBeGreaterThan(0);

      const detention = stats.categoryBreakdown.find((c) => c.category === "Unlawful Detention");
      expect(detention).toBeDefined();
      expect(detention?.count).toBe(2);
      expect(detention?.activeCount).toBe(1); // 1 submitted, 1 withdrawn

      const harassment = stats.categoryBreakdown.find((c) => c.category === "Harassment & Intimidation");
      expect(harassment).toBeDefined();
      expect(harassment?.count).toBe(2);
      expect(harassment?.activeCount).toBe(2); // 1 awaiting_info, 1 action_taken
    });
  });

  describe("AC 5: Evidence Verification Status Aggregation", () => {
    it("aggregates evidence items across all verification statuses with verification rate", () => {
      const stats = calculateEvidenceStatistics(INITIAL_MOCK_EVIDENCE);

      expect(stats.totalEvidence).toBe(8);
      // pending (1) + under_review (1) = 2 awaiting
      expect(stats.awaitingVerification).toBe(2);
      // approved (1) + validated (1) + rejected (1) = 3 completed
      expect(stats.completedVerification).toBe(3);
      // 3 / 8 = 38%
      expect(stats.verificationRatePercentage).toBe(38);

      const pendingStatus = stats.statusBreakdown.find((s) => s.status === "pending");
      expect(pendingStatus?.count).toBe(1);

      const validatedStatus = stats.statusBreakdown.find((s) => s.status === "validated");
      expect(validatedStatus?.count).toBe(1);

      const escalatedStatus = stats.statusBreakdown.find((s) => s.status === "escalated");
      expect(escalatedStatus?.count).toBe(1);
    });
  });

  describe("JN-389: Workload Ratios Calculation", () => {
    it("calculates avg cases per officer and avg evidence per checker accurately", () => {
      const workload = calculateWorkloadMetrics(
        INITIAL_MOCK_USERS,
        INITIAL_MOCK_CASES,
        INITIAL_MOCK_EVIDENCE,
      );

      // 2 active officers, 5 active cases -> 2.5
      expect(workload.activeOfficersCount).toBe(2);
      expect(workload.avgCasesPerOfficer).toBe(2.5);

      // 2 active checkers, 2 pending/under_review evidence -> 1.0
      expect(workload.activeCheckersCount).toBe(2);
      expect(workload.avgEvidencePerChecker).toBe(1);
    });
  });

  describe("AC 6 & JN-390: Dynamic Query Filtering & Empty States", () => {
    it("returns complete statistics for default filter", async () => {
      const result = await getSystemStatistics({}, "system_admin");

      expect(result.userStats.totalUsers).toBe(13);
      expect(result.caseStats.totalCases).toBe(8);
      expect(result.evidenceStats.totalEvidence).toBe(8);
      expect(result.filterMeta.dateRange).toBe("all");
    });

    it("filters cases dynamically by category filter", async () => {
      const result = await getSystemStatistics(
        { category: "Unlawful Detention" },
        "system_admin",
      );

      expect(result.caseStats.totalCases).toBe(2);
      expect(result.caseStats.categoryBreakdown[0].category).toBe("Unlawful Detention");
    });

    it("handles empty data state gracefully", async () => {
      setEmptyStatisticsStoreForTesting();

      const result = await getSystemStatistics({}, "system_admin");

      expect(result.userStats.totalUsers).toBe(0);
      expect(result.userStats.activeUsers).toBe(0);
      expect(result.caseStats.totalCases).toBe(0);
      expect(result.caseStats.activeCases).toBe(0);
      expect(result.evidenceStats.totalEvidence).toBe(0);
      expect(result.evidenceStats.verificationRatePercentage).toBe(0);
      expect(result.workload.avgCasesPerOfficer).toBe(0);
    });
  });

  describe("AC 7: Access Control & Authorization Security", () => {
    it("permits authorized system_admin role", () => {
      expect(() => requireAdministrator("system_admin")).not.toThrow();
      expect(() => requireAdministrator("System Administrator")).not.toThrow();
    });

    it("rejects unauthorized roles with 403 AuthorizationError", async () => {
      expect(() => requireAdministrator("reporter")).toThrow(/strictly restricted to System Administrators/);
      expect(() => requireAdministrator("case_officer")).toThrow(/strictly restricted to System Administrators/);
      expect(() => requireAdministrator("evidence_checker")).toThrow(/strictly restricted to System Administrators/);
      expect(() => requireAdministrator(undefined)).toThrow(/strictly restricted to System Administrators/);

      await expect(getSystemStatistics({}, "case_officer")).rejects.toThrow(
        /strictly restricted to System Administrators/,
      );
    });
  });
});
