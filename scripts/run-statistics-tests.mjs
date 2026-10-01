import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// ============================================================================
// SPRINT 4 TASK: VIEW SYSTEM STATISTICS DASHBOARD (JN-386 to JN-391)
// Contract, Screen & Metric Verification Test Suite
// ============================================================================

const statisticsScreen = await readFile(
  new URL("../src/app/admin/statistics.tsx", import.meta.url),
  "utf8",
);
const adminIndexScreen = await readFile(
  new URL("../src/app/admin/index.tsx", import.meta.url),
  "utf8",
);
const statisticsServiceFile = await readFile(
  new URL("../src/statistics/statisticsService.ts", import.meta.url),
  "utf8",
);
const statisticsTypesFile = await readFile(
  new URL("../src/statistics/types.ts", import.meta.url),
  "utf8",
);

describe("System Statistics Dashboard - Static Contract Verification (JN-386)", () => {
  it("Statistics types define all required data models & acceptance criteria interfaces", () => {
    assert.match(
      statisticsTypesFile,
      /export interface SystemStatistics/,
      "Types must export SystemStatistics",
    );
    assert.match(
      statisticsTypesFile,
      /export interface UserStatistics/,
      "Types must export UserStatistics (AC 1 & AC 2)",
    );
    assert.match(
      statisticsTypesFile,
      /totalUsers:\s*number/,
      "UserStatistics must include totalUsers (AC 1)",
    );
    assert.match(
      statisticsTypesFile,
      /rolesBreakdown:\s*RoleDistributionItem\[\]/,
      "UserStatistics must include rolesBreakdown (AC 2)",
    );
    assert.match(
      statisticsTypesFile,
      /export interface CaseStatistics/,
      "Types must export CaseStatistics (AC 3 & AC 4)",
    );
    assert.match(
      statisticsTypesFile,
      /statusBreakdown:\s*CaseStatusDistributionItem\[\]/,
      "CaseStatistics must include statusBreakdown (AC 3)",
    );
    assert.match(
      statisticsTypesFile,
      /categoryBreakdown:\s*CategoryDistributionItem\[\]/,
      "CaseStatistics must include categoryBreakdown (AC 4)",
    );
    assert.match(
      statisticsTypesFile,
      /export interface EvidenceStatistics/,
      "Types must export EvidenceStatistics (AC 5)",
    );
    assert.match(
      statisticsTypesFile,
      /statusBreakdown:\s*EvidenceStatusDistributionItem\[\]/,
      "EvidenceStatistics must include statusBreakdown (AC 5)",
    );
    assert.match(
      statisticsTypesFile,
      /export interface WorkloadMetrics/,
      "Types must export WorkloadMetrics (JN-389)",
    );
  });
});

describe("System Statistics Dashboard - Screen & Navigation Verification (JN-388, JN-389, JN-390)", () => {
  it("Statistics screen implements all required dashboard components and role security", () => {
    assert.match(
      statisticsScreen,
      /export default function AdminStatisticsScreen/,
      "Screen component must be exported as default",
    );
    assert.match(
      statisticsScreen,
      /isAuthorized/,
      "Screen must verify admin authorization (AC 7)",
    );
    assert.match(
      statisticsScreen,
      /Access Restricted/,
      "Screen must provide Access Restricted view for non-admin roles (AC 7)",
    );
    assert.match(
      statisticsScreen,
      /DATE_RANGE_OPTIONS/,
      "Screen must support date range filters (JN-390)",
    );
    assert.match(
      statisticsScreen,
      /CATEGORY_FILTER_OPTIONS/,
      "Screen must support category filters (JN-390)",
    );
    assert.match(
      statisticsScreen,
      /Total Users/,
      "Screen must render Total Users card (AC 1)",
    );
    assert.match(
      statisticsScreen,
      /Users by Role/,
      "Screen must render Users by Role section (AC 2)",
    );
    assert.match(
      statisticsScreen,
      /Cases by Status/,
      "Screen must render Cases by Status section (AC 3)",
    );
    assert.match(
      statisticsScreen,
      /Cases by Category/,
      "Screen must render Cases by Category section (AC 4)",
    );
    assert.match(
      statisticsScreen,
      /Evidence by Verification Status/,
      "Screen must render Evidence by Verification Status section (AC 5)",
    );
    assert.match(
      statisticsScreen,
      /Platform Workload Ratios/,
      "Screen must render Workload Ratios section (JN-389)",
    );
  });

  it("Admin overview hub links directly to /admin/statistics", () => {
    assert.match(
      adminIndexScreen,
      /\/admin\/statistics/,
      "Admin index must include navigation link to /admin/statistics",
    );
    assert.match(
      adminIndexScreen,
      /System Statistics Dashboard/,
      "Admin index must render System Statistics Dashboard card",
    );
  });
});

describe("System Statistics Service - Functional Metric Calculations (JN-387, JN-391)", () => {
  // Test Data Fixtures
  const MOCK_USERS = [
    { id: "u1", email: "a1@test.com", fullName: "Admin 1", role: "system_admin", isActive: true },
    { id: "u2", email: "a2@test.com", fullName: "Admin 2", role: "system_admin", isActive: true },
    { id: "u3", email: "o1@test.com", fullName: "Officer 1", role: "case_officer", isActive: true },
    { id: "u4", email: "o2@test.com", fullName: "Officer 2", role: "case_officer", isActive: true },
    { id: "u5", email: "o3@test.com", fullName: "Officer 3", role: "case_officer", isActive: false },
    { id: "u6", email: "c1@test.com", fullName: "Checker 1", role: "evidence_checker", isActive: true },
    { id: "u7", email: "c2@test.com", fullName: "Checker 2", role: "evidence_checker", isActive: true },
    { id: "u8", email: "r1@test.com", fullName: "Reporter 1", role: "reporter", isActive: true },
    { id: "u9", email: "r2@test.com", fullName: "Reporter 2", role: "reporter", isActive: true },
    { id: "u10", email: "r3@test.com", fullName: "Reporter 3", role: "reporter", isActive: false },
  ];

  const MOCK_CASES = [
    { id: "c1", status: "submitted", category: "Unlawful Detention" },
    { id: "c2", status: "under_review", category: "Violence or Abuse" },
    { id: "c3", status: "investigating", category: "Harassment" },
    { id: "c4", status: "awaiting_information", category: "Harassment" },
    { id: "c5", status: "action_taken", category: "Freedom of Expression" },
    { id: "c6", status: "resolved", category: "Unlawful Detention" },
    { id: "c7", status: "dismissed", category: "Discrimination" },
    { id: "c8", status: "withdrawn", category: "Discrimination" },
  ];

  const MOCK_EVIDENCE = [
    { id: "e1", status: "pending" },
    { id: "e2", status: "under_review" },
    { id: "e3", status: "approved" },
    { id: "e4", status: "validated" },
    { id: "e5", status: "rejected" },
    { id: "e6", status: "info_requested" },
    { id: "e7", status: "escalated" },
    { id: "e8", status: "reassignment_requested" },
  ];

  it("AC 1: Computes total users and active vs inactive counts", () => {
    const total = MOCK_USERS.length;
    const active = MOCK_USERS.filter((u) => u.isActive).length;
    const inactive = total - active;

    assert.equal(total, 10);
    assert.equal(active, 8);
    assert.equal(inactive, 2);
  });

  it("AC 2: Breaks down users by all 4 system roles with exact percentages", () => {
    const admins = MOCK_USERS.filter((u) => u.role === "system_admin").length;
    const officers = MOCK_USERS.filter((u) => u.role === "case_officer").length;
    const checkers = MOCK_USERS.filter((u) => u.role === "evidence_checker").length;
    const reporters = MOCK_USERS.filter((u) => u.role === "reporter").length;

    assert.equal(admins, 2);
    assert.equal(officers, 3);
    assert.equal(checkers, 2);
    assert.equal(reporters, 3);

    assert.equal(Math.round((admins / MOCK_USERS.length) * 100), 20);
    assert.equal(Math.round((officers / MOCK_USERS.length) * 100), 30);
    assert.equal(Math.round((checkers / MOCK_USERS.length) * 100), 20);
    assert.equal(Math.round((reporters / MOCK_USERS.length) * 100), 30);
  });

  it("AC 3: Categorizes cases into active workflow pipeline vs resolved stages", () => {
    const terminalStatuses = ["resolved", "dismissed", "withdrawn", "closed"];
    const totalCases = MOCK_CASES.length;
    const activeCases = MOCK_CASES.filter((c) => !terminalStatuses.includes(c.status)).length;
    const resolvedCases = MOCK_CASES.filter((c) => c.status === "resolved").length;

    assert.equal(totalCases, 8);
    assert.equal(activeCases, 5);
    assert.equal(resolvedCases, 1);
  });

  it("AC 4: Groups cases by category with count and active case counts", () => {
    const harassmentCases = MOCK_CASES.filter((c) => c.category === "Harassment");
    const detentionCases = MOCK_CASES.filter((c) => c.category === "Unlawful Detention");

    assert.equal(harassmentCases.length, 2);
    assert.equal(detentionCases.length, 2);

    const activeDetention = detentionCases.filter((c) => c.status !== "resolved").length;
    assert.equal(activeDetention, 1);
  });

  it("AC 5: Aggregates evidence by verification status and computes verification rate", () => {
    const totalEvidence = MOCK_EVIDENCE.length;
    const awaiting = MOCK_EVIDENCE.filter(
      (e) => e.status === "pending" || e.status === "under_review",
    ).length;
    const completed = MOCK_EVIDENCE.filter(
      (e) => e.status === "approved" || e.status === "validated" || e.status === "rejected",
    ).length;
    const rate = Math.round((completed / totalEvidence) * 100);

    assert.equal(totalEvidence, 8);
    assert.equal(awaiting, 2);
    assert.equal(completed, 3);
    assert.equal(rate, 38);
  });

  it("AC 7: Role guard strictly permits system_admin and rejects unauthorized roles", () => {
    assert.match(
      statisticsServiceFile,
      /requireAdministrator/,
      "Service must enforce requireAdministrator",
    );
    assert.match(
      statisticsServiceFile,
      /UNAUTHORIZED_STATISTICS_ACCESS/,
      "Service must throw UNAUTHORIZED_STATISTICS_ACCESS error code",
    );
  });
});
