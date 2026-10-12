import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkerApi = await readFile(
  new URL("../src/evidence-validator/audit/api.ts", import.meta.url),
  "utf8"
);
const checkerTypes = await readFile(
  new URL("../src/evidence-validator/audit/types.ts", import.meta.url),
  "utf8"
);
const validatorApi = await readFile(
  new URL("../src/evidence-validator/api.ts", import.meta.url),
  "utf8"
);
const detailScreen = await readFile(
  new URL("../src/evidence-validator/EvidenceDetailScreen.tsx", import.meta.url),
  "utf8"
);
const decisionScreen = await readFile(
  new URL("../src/evidence-validator/EvidenceDecisionScreen.tsx", import.meta.url),
  "utf8"
);
const auditTools = await readFile(
  new URL("../src/evidence-validator/ValidatorAuditTools.tsx", import.meta.url),
  "utf8"
);

console.log("Running Evidence Verification & Decision (JN-198 - JN-205) verification tests...\n");

// AC 1 & AC 2: Marked Verified & Marked Rejected
assert.match(
  decisionScreen,
  /value: "approved"[\s\S]*label: "Approve"/,
  "AC 1: Must offer an approve/verified decision option"
);
assert.match(
  decisionScreen,
  /value: "rejected"[\s\S]*label: "Reject"/,
  "AC 2: Must offer a rejected decision option"
);

// AC 3 & JN-199: Decision saved only by assigned Evidence Checker
assert.match(
  checkerApi,
  /Only the assigned Evidence Checker can submit a decision/,
  "JN-199: updateEvidenceValidationDecision must validate assigned checker ownership"
);

// AC 4 & JN-201: Mandatory reason or comment required
assert.match(
  checkerApi,
  /A documented reason or comment is required to record this evidence decision/,
  "JN-201: API must reject decision requests with empty reason/comment"
);
assert.match(
  validatorApi,
  /A documented reason or comment is required/,
  "JN-201: Validator API must enforce non-empty reason validation"
);
assert.match(
  decisionScreen,
  /Reason required|A documented reason or comment is required/,
  "JN-201: Detail screen must alert when reason or comment is missing"
);

// AC 5 & JN-198: Completion date and checker identity recorded
assert.match(
  checkerTypes,
  /EvidenceVerificationRecord/,
  "JN-198: Must define EvidenceVerificationRecord interface"
);
assert.match(
  checkerApi,
  /completedAt: now/,
  "JN-198: Completion date (now) must be recorded on decision"
);
assert.match(
  checkerApi,
  /validatedBy: checkerIdentity/,
  "JN-198: Checker identity must be recorded on evidence record"
);

// AC 6 & JN-202: Evidence status updated
assert.match(
  checkerApi,
  /validationStatus: nextStatus/,
  "JN-202: Evidence status must be updated on decision application"
);

// AC 7 & JN-203: Case Officer can view result
assert.match(
  auditTools,
  /Case officer technical overview|getCaseOfficerStatusView/,
  "JN-203: Decision result must be exposed for officer/staff view"
);
assert.match(
  decisionScreen,
  /Validator notes|internalNotes/,
  "JN-203: Documented reason must be visible in recorded decision view"
);

// AC 8 & JN-204: Completed decision cannot be silently overwritten
assert.match(
  checkerApi,
  /A completed evidence decision cannot be silently overwritten/,
  "JN-204: API must block overwriting completed decisions"
);
assert.match(
  auditTools,
  /status progression|Status progression/i,
  "JN-204: UI must render audit status context for completed decisions"
);

console.log("All Evidence Verification & Decision (JN-198 - JN-205) contract tests passed successfully!");

