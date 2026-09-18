import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  requestEvidenceClarificationOrReplacement,
  linkReplacementEvidence,
  resetInMemoryEvidenceStore,
  fetchEvidenceCheckerQueue,
} from "../src/checker/api.js";

console.log("===============================================================");
console.log("JUSTICE NOW REPLACEMENT EVIDENCE & CLARIFICATION REQUEST TESTS");
console.log("Covers: JN-214, JN-215, JN-216, JN-217, JN-218, JN-219, JN-220");
console.log("===============================================================\n");

async function runTests() {
  resetInMemoryEvidenceStore();

  const typesContent = await readFile(new URL("../src/checker/types.ts", import.meta.url), "utf8");
  const apiContent = await readFile(new URL("../src/checker/api.ts", import.meta.url), "utf8");
  const detailScreenContent = await readFile(new URL("../src/app/checker/evidence/[id].tsx", import.meta.url), "utf8");

  // --------------------------------------------------------------------------
  // TEST 1 (JN-214 & JN-215): Clarification / Replacement Operation & Validation
  // --------------------------------------------------------------------------
  console.log("Test 1 (JN-214 & JN-215): Testing clarification operation and mandatory reason validation...");

  // Test empty reason rejection
  const emptyReasonRes = await requestEvidenceClarificationOrReplacement({
    evidenceId: "EVD-2026-9041",
    requestType: "replacement",
    reason: "   ",
    reporterInstructions: "Please re-upload a clear file.",
  });
  assert.equal(emptyReasonRes.ok, false, "JN-215: Must reject request when reason is blank");
  assert.match(emptyReasonRes.message, /reason/i, "JN-215: Message must state reason is mandatory");

  // Test empty reporter instructions rejection
  const emptyInstructionsRes = await requestEvidenceClarificationOrReplacement({
    evidenceId: "EVD-2026-9041",
    requestType: "replacement",
    reason: "Photo is blurry.",
    reporterInstructions: "   ",
  });
  assert.equal(emptyInstructionsRes.ok, false, "JN-217: Must reject request when reporter instructions are blank");

  // Valid request submission
  const validReqRes = await requestEvidenceClarificationOrReplacement({
    evidenceId: "EVD-2026-9041",
    requestType: "replacement",
    reasonCategory: "Unreadable / Low Quality Media",
    reason: "Crime scene photo is low resolution and truncated at lower margin.",
    internalNotes: "Requested high-res uncompressed copy for forensic review.",
    reporterInstructions: "Please upload an uncompressed JPEG image file showing full checkpoint margin.",
    checkerId: "checker-squad-1",
    checkerName: "Evidence Validator Specialist",
  });

  assert.equal(validReqRes.ok, true, "JN-214: Valid clarification/replacement request should succeed");
  console.log("  PASSED: JN-214 & JN-215 operation and validation rules verified.\n");

  // --------------------------------------------------------------------------
  // TEST 2 (JN-216): Connect Request to Case Officer Workflow
  // --------------------------------------------------------------------------
  console.log("Test 2 (JN-216): Verifying Case Officer workflow connection...");
  const requestRecord = validReqRes.requestRecord;
  assert.ok(requestRecord, "JN-216: ClarificationRequestRecord must be created");
  assert.equal(requestRecord.workflowStatus, "pending_officer_review", "JN-216: Workflow status must be 'pending_officer_review'");
  assert.ok(requestRecord.assignedOfficerId, "JN-216: Assigned officer ID must be attached");
  console.log("  PASSED: JN-216 Case Officer workflow linkage verified.\n");

  // --------------------------------------------------------------------------
  // TEST 3 (JN-217): Reporter-Facing Message Generation
  // --------------------------------------------------------------------------
  console.log("Test 3 (JN-217): Verifying Reporter-facing message format...");
  assert.equal(
    requestRecord.reporterInstructions,
    "Please upload an uncompressed JPEG image file showing full checkpoint margin.",
    "JN-217: Reporter instructions must match input"
  );
  console.log("  PASSED: JN-217 Reporter instructions verified.\n");

  // --------------------------------------------------------------------------
  // TEST 4 (JN-218): Update Evidence Status & Audit History
  // --------------------------------------------------------------------------
  console.log("Test 4 (JN-218): Verifying evidence status update and history recording...");
  const queue = await fetchEvidenceCheckerQueue();
  const updatedItem = queue.find((i) => i.id === "EVD-2026-9041");
  assert.ok(updatedItem, "Item must exist in queue");
  assert.equal(updatedItem.validationStatus, "info_requested", "JN-218: Status must transition to 'info_requested'");
  assert.ok(updatedItem.statusHistory.length >= 2, "JN-218: History entry must be recorded");
  assert.match(updatedItem.statusHistory[0].notes, /REPLACEMENT REQUESTED/, "JN-218: History note must include request type");
  console.log("  PASSED: JN-218 status transition and audit history verified.\n");

  // --------------------------------------------------------------------------
  // TEST 5 (JN-219): Link Replacement Evidence
  // --------------------------------------------------------------------------
  console.log("Test 5 (JN-219): Testing replacement evidence linking...");
  const linkRes = await linkReplacementEvidence({
    originalEvidenceId: "EVD-2026-9041",
    replacementEvidenceId: "EVD-2026-9042",
    checkerId: "checker-squad-1",
  });

  assert.equal(linkRes.ok, true, "JN-219: Linking replacement evidence should succeed");
  assert.equal(linkRes.originalRecord.replacedByEvidenceId, "EVD-2026-9042", "JN-219: Original item must reference replacement ID");
  assert.equal(linkRes.replacementRecord.replacesEvidenceId, "EVD-2026-9041", "JN-219: Replacement item must reference original ID");
  assert.equal(linkRes.originalRecord.activeClarificationRequest.workflowStatus, "fulfilled", "JN-219: Active clarification request must be marked fulfilled");
  console.log("  PASSED: JN-219 replacement evidence linking verified.\n");

  // --------------------------------------------------------------------------
  // TEST 6 (JN-220): Test Runner Execution Summary
  // --------------------------------------------------------------------------
  console.log("Test 6 (JN-220): Test clarification request workflow suite complete!");
  console.log("===============================================================");
  console.log("ALL CLARIFICATION & REPLACEMENT REQUEST TESTS PASSED (6/6)");
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
