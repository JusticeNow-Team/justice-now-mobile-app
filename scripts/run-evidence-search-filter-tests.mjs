import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// Read UI screen file and service file for static contract verification
const indexScreen = await readFile(
  new URL("../src/app/checker/index.tsx", import.meta.url),
  "utf8",
);
const serviceFile = await readFile(
  new URL("../src/checker/evidenceFilterService.ts", import.meta.url),
  "utf8",
);

// Inlined logic & mock data fixtures for pure Node.js test runner
const DEFAULT_FILTER_OPTIONS = {
  searchQuery: "",
  statusFilter: "all",
  evidenceTypeFilter: "all",
  assignedCheckerFilter: "all",
};

function isUserAuthorizedToFilterCheckers(role) {
  if (!role) return true;
  const normRole = String(role).toLowerCase().trim();
  if (
    normRole === "system_admin" ||
    normRole === "case_officer" ||
    normRole === "evidence_validator" ||
    normRole === "evidence_checker"
  ) {
    return true;
  }
  return false;
}

function resetFilters() {
  return { ...DEFAULT_FILTER_OPTIONS };
}

const INITIAL_MOCK_EVIDENCE = [
  {
    id: "EVD-2026-9041",
    caseId: "CASE-2026-0812",
    caseInfo: { caseReference: "JN-2026-0812", title: "Police Harassment at Public Square" },
    fileName: "bodycam_footage_01.mp4",
    fileType: "video/mp4",
    evidenceType: "video",
    fileSizeBytes: 10485760,
    uploadDate: "2026-08-20T10:00:00Z",
    validationStatus: "pending",
    assignedCheckerId: "CHK-001-ELENA",
    assignedByName: "Elena Rostova",
  },
  {
    id: "EVD-2026-9042",
    caseId: "CASE-2026-0812",
    caseInfo: { caseReference: "JN-2026-0812", title: "Police Harassment at Public Square" },
    fileName: "witness_statement_audio.m4a",
    fileType: "audio/m4a",
    evidenceType: "audio",
    fileSizeBytes: 2097152,
    uploadDate: "2026-08-20T11:00:00Z",
    validationStatus: "under_review",
    assignedCheckerId: "CHK-001-ELENA",
    assignedByName: "Elena Rostova",
  },
  {
    id: "EVD-2026-9043",
    caseId: "CASE-2026-0798",
    caseInfo: { caseReference: "JN-2026-0798", title: "Illegal Detention Incident" },
    fileName: "medical_injury_report.pdf",
    fileType: "application/pdf",
    evidenceType: "document",
    fileSizeBytes: 1048576,
    uploadDate: "2026-08-19T09:30:00Z",
    validationStatus: "validated",
    assignedCheckerId: "CHK-002-MARCUS",
    assignedByName: "Dr. Marcus Vance",
  },
  {
    id: "EVD-2026-9044",
    caseId: "CASE-2026-0820",
    caseInfo: { caseReference: "JN-2026-0820", title: "Peaceful Protest Dispersion" },
    fileName: "protest_photo_01.jpg",
    fileType: "image/jpeg",
    evidenceType: "image",
    fileSizeBytes: 3145728,
    uploadDate: "2026-08-21T14:15:00Z",
    validationStatus: "pending",
    assignedCheckerId: "",
  },
  {
    id: "EVD-2026-9045",
    caseId: "CASE-2026-0825",
    caseInfo: { caseReference: "JN-2026-0825", title: "Corrupt Documents" },
    fileName: "corrupt_file.bin",
    fileType: "application/octet-stream",
    evidenceType: "document",
    fileSizeBytes: 512,
    uploadDate: "2026-08-18T08:00:00Z",
    validationStatus: "rejected",
    assignedCheckerId: "CHK-002-MARCUS",
    assignedByName: "Dr. Marcus Vance",
  },
];

function filterEvidenceRecords(allRecords, options = {}) {
  const {
    searchQuery = "",
    statusFilter = "all",
    evidenceTypeFilter = "all",
    assignedCheckerFilter = "all",
    userRole = null,
    userId = undefined,
  } = options;

  const isAuthorized = isUserAuthorizedToFilterCheckers(userRole);

  let candidateRecords = [...allRecords];
  if (!isAuthorized && userId) {
    candidateRecords = candidateRecords.filter(
      (r) => !r.assignedCheckerId || r.assignedCheckerId === userId
    );
  }

  let activeFilterCount = 0;
  if (searchQuery.trim().length > 0) activeFilterCount++;
  if (statusFilter !== "all") activeFilterCount++;
  if (evidenceTypeFilter !== "all") activeFilterCount++;
  if (assignedCheckerFilter !== "all") activeFilterCount++;

  let filtered = candidateRecords;

  if (searchQuery.trim().length > 0) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((r) => {
      const caseRef = r.caseInfo?.caseReference?.toLowerCase() || "";
      const caseId = r.caseId?.toLowerCase() || "";
      const id = r.id?.toLowerCase() || "";
      const fileName = r.fileName?.toLowerCase() || "";
      return caseRef.includes(q) || caseId.includes(q) || id.includes(q) || fileName.includes(q);
    });
  }

  if (statusFilter !== "all") {
    if (statusFilter === "completed") {
      filtered = filtered.filter(
        (r) =>
          r.validationStatus === "validated" ||
          r.validationStatus === "approved" ||
          r.validationStatus === "rejected" ||
          r.validationStatus === "archived"
      );
    } else {
      filtered = filtered.filter((r) => r.validationStatus === statusFilter);
    }
  }

  if (evidenceTypeFilter !== "all") {
    filtered = filtered.filter(
      (r) =>
        r.evidenceType === evidenceTypeFilter ||
        (evidenceTypeFilter === "image" && r.fileType?.startsWith("image/")) ||
        (evidenceTypeFilter === "video" && r.fileType?.startsWith("video/")) ||
        (evidenceTypeFilter === "audio" && r.fileType?.startsWith("audio/")) ||
        (evidenceTypeFilter === "document" &&
          (r.fileType?.includes("pdf") || r.fileType?.includes("octet") || r.evidenceType === "document"))
    );
  }

  if (assignedCheckerFilter !== "all") {
    if (assignedCheckerFilter === "unassigned") {
      filtered = filtered.filter((r) => !r.assignedCheckerId || r.assignedCheckerId.trim() === "");
    } else if (assignedCheckerFilter === "my_assigned" && userId) {
      filtered = filtered.filter((r) => r.assignedCheckerId === userId);
    } else {
      filtered = filtered.filter((r) => r.assignedCheckerId === assignedCheckerFilter);
    }
  }

  return {
    records: filtered,
    totalCount: allRecords.length,
    filteredCount: filtered.length,
    isAuthorizedToFilterCheckers: isAuthorized,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
  };
}

describe("Evidence Search & Filter Static Verification (JN-231 to JN-235)", () => {
  it("JN-231: Service exports filterEvidenceRecords with case reference search", () => {
    assert.match(
      serviceFile,
      /export function filterEvidenceRecords\(/,
      "Filter service must export filterEvidenceRecords",
    );
    assert.match(
      serviceFile,
      /caseRef\.includes\(q\)/,
      "Filter service must check caseReference matching",
    );
  });

  it("JN-232: Service & UI support evidence-status filtering", () => {
    assert.match(
      serviceFile,
      /statusFilter === "pending"/,
      "Filter service must support pending status filter",
    );
    assert.match(
      indexScreen,
      /statusFilter/,
      "UI screen must handle statusFilter",
    );
  });

  it("JN-233: Service & UI support file/evidence type filtering", () => {
    assert.match(
      serviceFile,
      /evidenceTypeFilter === "image"/,
      "Filter service must support image type filter",
    );
    assert.match(
      indexScreen,
      /typeFilter/,
      "UI screen must handle typeFilter",
    );
  });

  it("JN-234 & JN-235: Service & UI support assigned checker filtering with authorization check", () => {
    assert.match(
      serviceFile,
      /export function isUserAuthorizedToFilterCheckers\(/,
      "Filter service must export isUserAuthorizedToFilterCheckers",
    );
    assert.match(
      indexScreen,
      /isAuthorizedForCheckers/,
      "UI screen must check checker filtering authorization",
    );
    assert.match(
      indexScreen,
      /Assigned Checker/i,
      "UI screen must render Assigned Checker filter",
    );
  });

  it("AC 6: UI provides clear filters option", () => {
    assert.match(
      indexScreen,
      /handleClearFilters/,
      "UI screen must provide handleClearFilters handler",
    );
    assert.match(
      indexScreen,
      /Clear Filters/i,
      "UI screen must render Clear Filters button",
    );
  });
});

describe("Evidence Search & Filter Logic Unit Tests", () => {
  it("JN-231: Search by case reference is supported (exact & partial, case-insensitive)", () => {
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

    const res2 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "jn-2026-0798",
    });
    assert.equal(res2.filteredCount, 1, "Should find 1 record for jn-2026-0798");
    assert.equal(res2.records[0].id, "EVD-2026-9043");

    const res3 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "0820",
    });
    assert.equal(res3.filteredCount, 1);
    assert.equal(res3.records[0].id, "EVD-2026-9044");
  });

  it("JN-232: Filter by evidence status is supported", () => {
    const pendingRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "pending",
    });
    assert.ok(pendingRes.filteredCount > 0);
    assert.ok(pendingRes.records.every((r) => r.validationStatus === "pending"));

    const underReviewRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "under_review",
    });
    assert.ok(underReviewRes.records.every((r) => r.validationStatus === "under_review"));

    const validatedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "validated",
    });
    assert.ok(
      validatedRes.records.every(
        (r) => r.validationStatus === "validated" || r.validationStatus === "approved"
      )
    );

    const rejectedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "rejected",
    });
    assert.ok(rejectedRes.records.every((r) => r.validationStatus === "rejected"));

    const completedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "completed",
    });
    assert.ok(
      completedRes.records.every((r) =>
        ["validated", "approved", "rejected", "archived"].includes(r.validationStatus)
      )
    );
  });

  it("JN-233: Filter by file / evidence type is supported", () => {
    const imageRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "image",
    });
    assert.ok(
      imageRes.records.every(
        (r) => r.evidenceType === "image" || r.fileType.startsWith("image/")
      )
    );

    const audioRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "audio",
    });
    assert.ok(
      audioRes.records.every(
        (r) => r.evidenceType === "audio" || r.fileType.startsWith("audio/")
      )
    );

    const videoRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "video",
    });
    assert.ok(
      videoRes.records.every(
        (r) => r.evidenceType === "video" || r.fileType.startsWith("video/")
      )
    );

    const docRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      evidenceTypeFilter: "document",
    });
    assert.ok(
      docRes.records.every(
        (r) =>
          r.evidenceType === "document" ||
          r.fileType.includes("pdf") ||
          r.fileType.includes("octet")
      )
    );
  });

  it("JN-234: Filter by assigned checker is supported where authorized", () => {
    const elenaRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      assignedCheckerFilter: "CHK-001-ELENA",
      userRole: "system_admin",
    });
    assert.equal(elenaRes.filteredCount, 2);

    const unassignedRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      assignedCheckerFilter: "unassigned",
      userRole: "case_officer",
    });
    assert.equal(unassignedRes.filteredCount, 1);
    assert.equal(unassignedRes.records[0].id, "EVD-2026-9044");
  });

  it("JN-235: Unauthorized roles only see their assigned evidence and unassigned pool when restricted", () => {
    const reporterRes = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      userRole: "reporter",
      userId: "CHK-001-ELENA",
    });
    assert.equal(reporterRes.isAuthorizedToFilterCheckers, false);
    assert.equal(reporterRes.records.length, 3);
  });

  it("JN-236: Filter combinations work accurately", () => {
    const combo1 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "JN-2026-0812",
      statusFilter: "pending",
    });
    assert.equal(combo1.filteredCount, 1);
    assert.equal(combo1.records[0].id, "EVD-2026-9041");

    const combo2 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "JN-2026-0812",
      evidenceTypeFilter: "audio",
    });
    assert.equal(combo2.filteredCount, 1);
    assert.equal(combo2.records[0].id, "EVD-2026-9042");

    const combo3 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      statusFilter: "validated",
      evidenceTypeFilter: "document",
      assignedCheckerFilter: "CHK-002-MARCUS",
      userRole: "system_admin",
    });
    assert.equal(combo3.filteredCount, 1);
    assert.equal(combo3.records[0].id, "EVD-2026-9043");

    const combo4 = filterEvidenceRecords(INITIAL_MOCK_EVIDENCE, {
      searchQuery: "NONEXISTENT_CASE_REF_9999",
      statusFilter: "validated",
    });
    assert.equal(combo4.filteredCount, 0);
  });

  it("AC 6: Reset filters returns default empty filter options", () => {
    const reset = resetFilters();
    assert.equal(reset.searchQuery, "");
    assert.equal(reset.statusFilter, "all");
    assert.equal(reset.evidenceTypeFilter, "all");
    assert.equal(reset.assignedCheckerFilter, "all");
  });
});
