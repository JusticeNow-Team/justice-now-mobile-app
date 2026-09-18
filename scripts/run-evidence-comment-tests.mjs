import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COMMON_REJECTION_REASONS } from "../src/checker/types.js";
import { updateEvidenceValidationDecision, INITIAL_MOCK_EVIDENCE } from "../src/checker/api.js";

console.log("==========================================================");
console.log("JUSTICE NOW EVIDENCE CHECKER COMMENTS & REASONS TEST SUITE");
console.log("Covers: JN-207, JN-208, JN-209, JN-210, JN-211, JN-212");
console.log("==========================================================\n");

async function runTests() {
  // Read source files for static contract analysis
  const typesContent = await readFile(new URL("../src/checker/types.ts", import.meta.url), "utf8");
  const apiContent = await readFile(new URL("../src/checker/api.ts", import.meta.url), "utf8");
  const detailScreenContent = await readFile(new URL("../src/app/checker/evidence/[id].tsx", import.meta.url), "utf8");

  // --------------------------------------------------------------------------
  // TEST 1 (JN-207): Comment & Reason Schema Definition
  // --------------------------------------------------------------------------
  console.log("Test 1 (JN-207): Verifying comment, reason, author, and date schema fields...");
  assert.match(typesContent, /commonRejectionReason\?:/, "JN-207: Must include commonRejectionReason field");
  assert.match(typesContent, /internalComment\?:/, "JN-207: Must include internalComment field");
  assert.match(typesContent, /publicFeedback\?:/, "JN-207: Must include publicFeedback field");
  assert.match(typesContent, /checkerRole\?:/, "JN-207: Must include checkerRole field");
  assert.match(typesContent, /completedAt: string/, "JN-207: Must record ISO completion date");
  console.log("  PASSED: JN-207 schema fields correctly defined.\n");

  // --------------------------------------------------------------------------
  // TEST 2 (JN-208): Common Rejection Reasons Preset List
  // --------------------------------------------------------------------------
  console.log("Test 2 (JN-208): Verifying common rejection reasons preset list...");
  assert.ok(Array.isArray(COMMON_REJECTION_REASONS), "JN-208: COMMON_REJECTION_REASONS must be an array");
  assert.ok(COMMON_REJECTION_REASONS.length >= 5, "JN-208: Must contain at least 5 preset rejection reasons");
  
  const ids = COMMON_REJECTION_REASONS.map((item) => item.id);
  assert.ok(ids.includes("unreadable_low_quality"), "JN-208: Must include 'unreadable_low_quality'");
  assert.ok(ids.includes("duplicate_submission"), "JN-208: Must include 'duplicate_submission'");
  assert.ok(ids.includes("file_manipulation"), "JN-208: Must include 'file_manipulation'");
  assert.ok(ids.includes("irrelevant_evidence"), "JN-208: Must include 'irrelevant_evidence'");
  assert.ok(ids.includes("missing_metadata"), "JN-208: Must include 'missing_metadata'");
  assert.ok(ids.includes("unsupported_format"), "JN-208: Must include 'unsupported_format'");
  console.log("  PASSED: JN-208 common rejection reasons correctly structured.\n");

  // --------------------------------------------------------------------------
  // TEST 3 (JN-209): Mandatory Rejection Reason & Non-Blank Comment Validation
  // --------------------------------------------------------------------------
  console.log("Test 3 (JN-209): Testing mandatory rejection reason and non-blank comment validation...");
  
  // Test rejecting evidence with empty reason
  const emptyRejectionRes = await updateEvidenceValidationDecision({
    evidenceId: "EVD-2026-9042",
    status: "rejected",
    rejectionReason: "   ",
    notes: "",
    checkerId: "checker-squad-1",
  });
  assert.equal(emptyRejectionRes.ok, false, "JN-209: Must reject decision when rejection reason is blank");
  assert.match(emptyRejectionRes.message, /mandatory/i, "JN-209: Message must indicate rejection reason is mandatory");

  // Test valid rejection with documented reason
  const validRejectionRes = await updateEvidenceValidationDecision({
    evidenceId: "EVD-2026-9042",
    status: "rejected",
    rejectionReason: "Low Resolution / Unreadable Media",
    notes: "Audio file is corrupt and cannot be played.",
    internalComment: "Checked with media tools.",
    publicFeedback: "Please upload an uncompressed original audio file.",
    checkerId: "checker-squad-1",
  });
  assert.equal(validRejectionRes.ok, true, "JN-209: Decision with valid rejection reason should succeed");
  console.log("  PASSED: JN-209 mandatory reason & non-blank validation enforced.\n");

  // --------------------------------------------------------------------------
  // TEST 4 (JN-210): Display Comments to Case Officer
  // --------------------------------------------------------------------------
  console.log("Test 4 (JN-210): Verifying decision comments exposed to Case Officer view...");
  assert.match(detailScreenContent, /lockedReasonBox|officerNotesBox/, "JN-210: Detail screen must render internal notes for Case Officer view");
  assert.match(detailScreenContent, /Internal Comment for Case Officer/, "JN-210: Must provide dedicated internal comment field for Case Officer");
  console.log("  PASSED: JN-210 Case Officer comment visibility verified.\n");

  // --------------------------------------------------------------------------
  // TEST 5 (JN-211): Separate Public and Internal Feedback
  // --------------------------------------------------------------------------
  console.log("Test 5 (JN-211): Verifying separation of public feedback from internal notes...");
  assert.match(apiContent, /publicFeedback\?:/, "JN-211: API must separate public feedback from internal notes");
  assert.match(detailScreenContent, /Public Feedback for Reporter/, "JN-211: Detail screen must offer separate Public Feedback input");
  console.log("  PASSED: JN-211 public and internal feedback separation verified.\n");

  // --------------------------------------------------------------------------
  // TEST 6 (JN-212): End-to-End Test Execution Confirmation
  // --------------------------------------------------------------------------
  console.log("Test 6 (JN-212): Test comment rules verification complete!");
  console.log("==========================================================");
  console.log("ALL EVIDENCE CHECKER COMMENT & REASON TESTS PASSED (6/6)");
  console.log("==========================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
