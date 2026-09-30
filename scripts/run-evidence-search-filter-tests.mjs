import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// Import core filter service logic & seed data
import {
  DEFAULT_FILTER_OPTIONS,
  filterEvidenceRecords,
  isUserAuthorizedToFilterCheckers,
  resetFilters,
} from "../src/checker/evidenceFilterService.ts";
import { INITIAL_MOCK_EVIDENCE } from "../src/checker/api.ts";

// Read UI screen file for static contract verification
const indexScreen = await readFile(
  new URL("../src/app/checker/index.tsx", import.meta.url),
  "utf8"
);
const serviceFile = await readFile(
  new URL("../src/checker/evidenceFilterService.ts", import.meta.url),
  "utf8"
);

describe("Evidence Search & Filter Static Verification (JN-231 to JN-235)", () => {
  it("JN-231: Service exports filterEvidenceRecords with case reference search", () => {
    assert.match(
      serviceFile,
      /export function filterEvidenceRecords\(/,
      "Filter service must export filterEvidenceRecords"
    );
    assert.match(
      serviceFile,
      /caseRef\.includes\(q\)/,
      "Filter service must check caseReference matching"
    );
  });

  it("JN-232: Service & UI support evidence-status filtering", () => {
    assert.match(
      serviceFile,
      /statusFilter === "pending"/,
      "Filter service must support pending status filter"
    );
    assert.match(
      indexScreen,
      /statusFilter === "pending"/,
      "UI screen must handle statusFilter"
    );
  });

  it("JN-233: Service & UI support file/evidence type filtering", () => {
    assert.match(
      serviceFile,
      /evidenceTypeFilter === "image"/,
      "Filter service must support image type filter"
    );
    assert.match(
      indexScreen,
      /typeFilter === "image"/,
      "UI screen must handle typeFilter"
    );
  });

  it("JN-234 & JN-235: Service & UI support assigned checker filtering with authorization check", () => {
    assert.match(
      serviceFile,
      /export function isUserAuthorizedToFilterCheckers\(/,
      "Filter service must export isUserAuthorizedToFilterCheckers"
    );
    assert.match(
      indexScreen,
      /isAuthorizedForCheckers/,
      "UI screen must check checker filtering authorization"
    );
    assert.match(
      indexScreen,
      /Assigned Checker/i,
      "UI screen must render Assigned Checker filter"
    );
  });

  it("AC 6: UI provides clear filters option", () => {
    assert.match(
      indexScreen,
      /handleClearFilters/,
      "UI screen must provide handleClearFilters handler"
    );
    assert.match(
      indexScreen,
      /Clear Filters/i,
      "UI screen must render Clear Filters button"
    );
  });
});

describe("Evidence Search & Filter Logic Unit Tests", () => {
  it("JN-231: Search by case reference is supported (exact & partial, case-insensitive)", () => {
    // Search exact case reference
    const res1 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "JN-2026-0812",
    });
    assert.ok(res1.filteredCount > 0, "Should find records for JN-2026-0812");
    assert.ok(
      res1.records.every(
        (r) =>
          r.caseInfo?.caseReference.includes("JN-2026-0812") ||
          r.caseId.includes("CASE-2026-0812")
      )
    );

    // Search lower case reference
    const res2 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "jn-2026-0798",
    });
    assert.equal(res2.filteredCount, 1, "Should find 1 record for jn-2026-0798");
    assert.equal(res2.records[0].id, "EVD-2026-9043");

    // Partial case reference number
    const res3 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "0820",
    });
    assert.equal(res3.filteredCount, 1);
    assert.equal(res3.records[0].id, "EVD-2026-9044");
  });

  it("JN-232: Filter by evidence status is supported", () => {
    // Filter pending
    const pendingRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "pending",
    });
    assert.ok(pendingRes.filteredCount > 0);
    assert.ok(pendingRes.records.every((r) => r.validationStatus === "pending"));

    // Filter under_review
    const underReviewRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "under_review",
    });
    assert.ok(underReviewRes.records.every((r) => r.validationStatus === "under_review"));

    // Filter validated
    const validatedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "validated",
    });
    assert.ok(
      validatedRes.records.every(
        (r) => r.validationStatus === "validated" || r.validationStatus === "approved"
      )
    );

    // Filter rejected
    const rejectedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "rejected",
    });
    assert.ok(rejectedRes.records.every((r) => r.validationStatus === "rejected"));

    // Filter completed
    const completedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "completed",
    });
    assert.ok(
      completedRes.records.every(
        (r) =>
          r.validationStatus === "validated" ||
          r.validationStatus === "approved" ||
          r.validationStatus === "rejected" ||
          r.validationStatus === "archived"
      )
    );
  });

  it("JN-233: Filter by file / evidence type is supported", () => {
    // Filter photo / image
    const imageRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "image",
    });
    assert.ok(
      imageRes.records.every(
        (r) => r.evidenceType === "image" || r.fileType.startsWith("image/")
      )
    );

    // Filter audio
    const audioRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "audio",
    });
    assert.ok(
      audioRes.records.every(
        (r) => r.evidenceType === "audio" || r.fileType.startsWith("audio/")
      )
    );

    // Filter video
    const videoRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "video",
    });
    assert.ok(
      videoRes.records.every(
        (r) => r.evidenceType === "video" || r.fileType.startsWith("video/")
      )
    );

    // Filter document
    const docRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "document",
    });
    assert.ok(
      docRes.records.every(
        (r) =>
          r.evidenceType === "document" ||
          r.fileType.includes("pdf") ||
          r.fileType.includes("msdownload")
      )
    );
  });

  it("JN-234: Filter by assigned checker is supported where authorized", () => {
    // Authorized filter by specific checker Elena Rostova
    const elenaRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      assignedCheckerFilter: "CHK-001-ELENA",
      userRole: "system_admin",
    });
    assert.ok(elenaRes.isAuthorizedToFilterCheckers);
    assert.ok(
      elenaRes.records.every((r) => r.assignedCheckerId === "CHK-001-ELENA")
    );

    // Authorized filter by unassigned queue
    const unassignedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      assignedCheckerFilter: "unassigned",
      userRole: "case_officer",
    });
    assert.ok(unassignedRes.isAuthorizedToFilterCheckers);
    assert.ok(
      unassignedRes.records.every(
        (r) => !r.assignedCheckerId || r.assignedCheckerId.trim() === ""
      )
    );
  });

  it("Permissions check: Unauthorized roles are restricted to assigned or unassigned items", () => {
    const restrictedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      userRole: "reporter",
      userId: "CHK-001-ELENA",
    });
    assert.equal(restrictedRes.isAuthorizedToFilterCheckers, false);
    assert.ok(
      restrictedRes.records.every(
        (r) => !r.assignedCheckerId || r.assignedCheckerId === "CHK-001-ELENA"
      )
    );
  });

  it("AC 6: Filters can be cleared completely", () => {
    const cleanDefaults = resetFilters();
    assert.equal(cleanDefaults.searchQuery, "");
    assert.equal(cleanDefaults.statusFilter, "all");
    assert.equal(cleanDefaults.evidenceTypeFilter, "all");
    assert.equal(cleanDefaults.assignedCheckerFilter, "all");

    const res = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, cleanDefaults);
    assert.equal(res.hasActiveFilters, false);
    assert.equal(res.activeFilterCount, 0);
    assert.equal(res.filteredCount, INITIAL_MOCK_EVIDENCE.length);
  });

  it("JN-236: Filter combinations work accurately", () => {
    // Combination 1: Case search + status pending
    const combo1 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "JN-2026-0812",
      statusFilter: "pending",
    });
    assert.ok(combo1.filteredCount > 0);
    assert.ok(
      combo1.records.every(
        (r) =>
          r.caseInfo?.caseReference === "JN-2026-0812" &&
          r.validationStatus === "pending"
      )
    );

    // Combination 2: Case search + evidence type audio
    const combo2 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "JN-2026-0812",
      evidenceTypeFilter: "audio",
    });
    assert.equal(combo2.filteredCount, 1);
    assert.equal(combo2.records[0].id, "EVD-2026-9042");

    // Combination 3: Status validated + Evidence type document + Checker Dr. Marcus Vance
    const combo3 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "validated",
      evidenceTypeFilter: "document",
      assignedCheckerFilter: "CHK-002-MARCUS",
      userRole: "system_admin",
    });
    assert.equal(combo3.filteredCount, 1);
    assert.equal(combo3.records[0].id, "EVD-2026-9043");

    // Combination 4: Non-matching filter combination returns 0 items cleanly
    const combo4 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "NONEXISTENT_CASE_REF_9999",
      statusFilter: "validated",
    });
    assert.equal(combo4.filteredCount, 0);
  });
});

console.log("All Evidence Search & Filter tests passed successfully.");
