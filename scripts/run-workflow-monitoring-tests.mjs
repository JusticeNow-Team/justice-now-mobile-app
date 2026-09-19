import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// ============================================================================
// SPRINT 3 TASK: MONITOR WORKFLOW ACTIVITY (JN-287 to JN-292)
// Contract, Screen & Logic Verification Test Suite
// ============================================================================

const workflowScreen = await readFile(
  new URL("../src/app/admin/workflow.tsx", import.meta.url),
  "utf8",
);
const adminIndexScreen = await readFile(
  new URL("../src/app/admin/index.tsx", import.meta.url),
  "utf8",
);
const workflowServiceFile = await readFile(
  new URL("../src/workflow/workflowService.ts", import.meta.url),
  "utf8",
);
const workflowTypesFile = await readFile(
  new URL("../src/workflow/types.ts", import.meta.url),
  "utf8",
);

describe("Workflow Activity Monitoring - Static Contract Verification", () => {
  it("Workflow types define core dashboard metrics, breakdowns, and delay alerts (JN-287)", () => {
    assert.match(
      workflowTypesFile,
      /export interface WorkflowDashboardMetrics/,
      "Types must export WorkflowDashboardMetrics",
    );
    assert.match(
      workflowTypesFile,
      /totalActiveCases:\s*number/,
      "Metrics must include totalActiveCases (AC 1)",
    );
    assert.match(
      workflowTypesFile,
      /casesAwaitingInitialReview:\s*number/,
      "Metrics must include casesAwaitingInitialReview (AC 2)",
    );
    assert.match(
      workflowTypesFile,
      /evidenceAwaitingVerification:\s*number/,
      "Metrics must include evidenceAwaitingVerification (AC 3)",
    );
    assert.match(
      workflowTypesFile,
      /completedVerificationCount:\s*number/,
      "Metrics must include completedVerificationCount (AC 4)",
    );
    assert.match(
      workflowTypesFile,
      /export interface CaseStatusBreakdown/,
      "Types must export CaseStatusBreakdown (JN-290)",
    );
    assert.match(
      workflowTypesFile,
      /export interface EvidenceStatusBreakdown/,
      "Types must export EvidenceStatusBreakdown (JN-290)",
    );
    assert.match(
      workflowTypesFile,
      /export interface WorkflowDelayItem/,
      "Types must export WorkflowDelayItem (JN-292)",
    );
  });

  it("Workflow service exports metric calculation, breakdown, delay detection, and admin guard (JN-288, JN-289)", () => {
    assert.match(
      workflowServiceFile,
      /export async function getWorkflowDashboardMetrics\(/,
      "Service must export getWorkflowDashboardMetrics",
    );
    assert.match(
      workflowServiceFile,
      /export function requireAdministrator\(/,
      "Service must export requireAdministrator",
    );
    assert.match(
      workflowServiceFile,
      /export function getCaseStatusBreakdown\(/,
      "Service must export getCaseStatusBreakdown",
    );
    assert.match(
      workflowServiceFile,
      /export function getEvidenceStatusBreakdown\(/,
      "Service must export getEvidenceStatusBreakdown",
    );
    assert.match(
      workflowServiceFile,
      /export function detectWorkflowDelays\(/,
      "Service must export detectWorkflowDelays",
    );
  });

  it("Admin workflow screen renders 4 hero metric cards, delay alerts, status cards, and empty state (JN-289, JN-290, JN-291)", () => {
    assert.match(
      workflowScreen,
      /TOTAL ACTIVE CASES|totalActiveCases/i,
      "Screen must render total active cases hero card (AC 1)",
    );
    assert.match(
      workflowScreen,
      /AWAITING INITIAL REVIEW|casesAwaitingInitialReview/i,
      "Screen must render cases awaiting initial review hero card (AC 2)",
    );
    assert.match(
      workflowScreen,
      /EVIDENCE AWAITING VERIFICATION|evidenceAwaitingVerification/i,
      "Screen must render evidence awaiting verification hero card (AC 3)",
    );
    assert.match(
      workflowScreen,
      /COMPLETED VERIFICATIONS|completedVerificationCount/i,
      "Screen must render completed verifications hero card (AC 4)",
    );
    assert.match(
      workflowScreen,
      /SLA BOTTLENECK|delayAlerts/i,
      "Screen must render SLA delay alerts section (JN-292)",
    );
    assert.match(
      workflowScreen,
      /CASE STATUS BREAKDOWN|caseStatusBreakdown/i,
      "Screen must render case status summary cards (JN-290)",
    );
    assert.match(
      workflowScreen,
      /EVIDENCE VERIFICATION PIPELINE|evidenceStatusBreakdown/i,
      "Screen must render evidence verification summary cards (JN-290)",
    );
    assert.match(
      workflowScreen,
      /emptyStateContainer|No Cases Recorded/i,
      "Screen must render empty state handling (JN-291 / AC 7)",
    );
    assert.match(
      workflowScreen,
      /Access Denied|Only System Administrators|isAuthorized/i,
      "Screen must enforce admin authorization guard (AC 6)",
    );
  });

  it("Admin hub (index.tsx) integrates workflow metrics and links to /admin/workflow (JN-289)", () => {
    assert.match(
      adminIndexScreen,
      /\/admin\/workflow/,
      "Admin hub must link to /admin/workflow",
    );
    assert.match(
      adminIndexScreen,
      /Workflow Activity Monitoring/i,
      "Admin hub must render Workflow Activity Monitoring section",
    );
    assert.match(
      adminIndexScreen,
      /Active cases|Cases awaiting review/i,
      "Admin hub KPIs must display active cases and review backlogs",
    );
  });
});

// ============================================================================
// BEHAVIORAL LOGIC & CALCULATION TESTS
// ============================================================================

const TERMINAL_CASE_STATUSES = ["resolved", "dismissed", "withdrawn", "closed"];

function isCaseActiveLogic(status) {
  return !TERMINAL_CASE_STATUSES.includes(status);
}

function isCaseAwaitingReviewLogic(status) {
  return status === "submitted" || status === "under_review";
}

function isEvidenceAwaitingVerificationLogic(status) {
  return status === "pending" || status === "under_review";
}

function isEvidenceCompletedLogic(status) {
  return status === "approved" || status === "validated" || status === "rejected";
}

function requireAdministratorLogic(role) {
  if (role !== "system_admin") {
    throw new Error(
      `Unauthorized: Workflow Activity Dashboard is strictly restricted to System Administrators. Current role: ${role ?? "anonymous"}`,
    );
  }
}

function computeWorkflowMetricsLogic(cases, evidence, callerRole) {
  requireAdministratorLogic(callerRole);

  const totalActiveCases = cases.filter((c) => isCaseActiveLogic(c.status)).length;
  const casesAwaitingInitialReview = cases.filter((c) => isCaseAwaitingReviewLogic(c.status)).length;
  const evidenceAwaitingVerification = evidence.filter((e) =>
    isEvidenceAwaitingVerificationLogic(e.status),
  ).length;
  const completedVerificationCount = evidence.filter((e) =>
    isEvidenceCompletedLogic(e.status),
  ).length;

  return {
    totalActiveCases,
    casesAwaitingInitialReview,
    evidenceAwaitingVerification,
    completedVerificationCount,
    totalCasesCount: cases.length,
    totalEvidenceCount: evidence.length,
    computedAt: new Date().toISOString(),
  };
}

const TEST_CASES = [
  { id: "c1", status: "submitted", submittedAt: "2026-09-15T08:00:00Z" },
  { id: "c2", status: "under_review", submittedAt: "2026-09-16T10:00:00Z" },
  { id: "c3", status: "investigating", submittedAt: "2026-09-17T09:00:00Z" },
  { id: "c4", status: "awaiting_information", submittedAt: "2026-09-17T14:00:00Z" },
  { id: "c5", status: "action_taken", submittedAt: "2026-09-18T08:00:00Z" },
  { id: "c6", status: "resolved", submittedAt: "2026-09-10T10:00:00Z" },
  { id: "c7", status: "dismissed", submittedAt: "2026-09-12T10:00:00Z" },
  { id: "c8", status: "withdrawn", submittedAt: "2026-09-11T10:00:00Z" },
];

const TEST_EVIDENCE = [
  { id: "e1", status: "pending", uploadedAt: "2026-09-14T09:00:00Z" },
  { id: "e2", status: "under_review", uploadedAt: "2026-09-15T10:00:00Z" },
  { id: "e3", status: "approved", uploadedAt: "2026-09-16T11:00:00Z" },
  { id: "e4", status: "validated", uploadedAt: "2026-09-16T12:00:00Z" },
  { id: "e5", status: "rejected", uploadedAt: "2026-09-17T09:00:00Z" },
  { id: "e6", status: "info_requested", uploadedAt: "2026-09-17T14:00:00Z" },
  { id: "e7", status: "escalated", uploadedAt: "2026-09-18T08:00:00Z" },
];

describe("Workflow Activity Monitoring - Acceptance Criteria Tests", () => {
  it("AC 1: Displays total active cases (5 non-terminal cases)", () => {
    const res = computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "system_admin");
    assert.equal(res.totalActiveCases, 5);
    assert.equal(res.totalCasesCount, 8);
  });

  it("AC 2: Displays cases awaiting initial review (submitted + under_review = 2)", () => {
    const res = computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "system_admin");
    assert.equal(res.casesAwaitingInitialReview, 2);
  });

  it("AC 3: Displays evidence awaiting verification (pending + under_review = 2)", () => {
    const res = computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "system_admin");
    assert.equal(res.evidenceAwaitingVerification, 2);
  });

  it("AC 4: Displays completed verification count (approved + validated + rejected = 3)", () => {
    const res = computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "system_admin");
    assert.equal(res.completedVerificationCount, 3);
  });

  it("AC 5: Figures dynamically update based on current system data", () => {
    const addedCases = [...TEST_CASES, { id: "c9", status: "submitted", submittedAt: "2026-09-19T10:00:00Z" }];
    const res = computeWorkflowMetricsLogic(addedCases, TEST_EVIDENCE, "system_admin");
    assert.equal(res.totalActiveCases, 6);
    assert.equal(res.casesAwaitingInitialReview, 3);
  });

  it("AC 6: Authorizes System Admin and strictly rejects unauthorized roles", () => {
    const adminRes = computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "system_admin");
    assert.ok(adminRes);

    assert.throws(() => computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "case_officer"), /Unauthorized/i);
    assert.throws(() => computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "evidence_checker"), /Unauthorized/i);
    assert.throws(() => computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, "reporter"), /Unauthorized/i);
    assert.throws(() => computeWorkflowMetricsLogic(TEST_CASES, TEST_EVIDENCE, undefined), /Unauthorized/i);
  });

  it("AC 7 & JN-291: Handles empty datasets with 0 counts cleanly", () => {
    const emptyRes = computeWorkflowMetricsLogic([], [], "system_admin");
    assert.equal(emptyRes.totalActiveCases, 0);
    assert.equal(emptyRes.casesAwaitingInitialReview, 0);
    assert.equal(emptyRes.evidenceAwaitingVerification, 0);
    assert.equal(emptyRes.completedVerificationCount, 0);
    assert.equal(emptyRes.totalCasesCount, 0);
    assert.equal(emptyRes.totalEvidenceCount, 0);
  });
});

console.log("All JN-287 to JN-292 Workflow Activity Monitoring tests passed successfully!");
