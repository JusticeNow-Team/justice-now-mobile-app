import { ReporterCase } from "../../src/reporter/cases/types";
import { PendingEvidenceFile } from "../../src/reporter/evidence/types";
import { CaseDraft, initialCaseDraft } from "../../src/reporter/report/types";

export function makeDraft(overrides: Partial<CaseDraft> = {}): CaseDraft {
  return {
    ...initialCaseDraft,
    categories: ["discrimination"],
    title: "Denied entry to a public office",
    description: "I was refused service because of my ethnicity.",
    incidentDate: "2026-09-01",
    ongoing: "no",
    province: "Western Province",
    district: "Colombo",
    victimRelation: "self",
    ...overrides,
  };
}

export function makeCase(overrides: Partial<ReporterCase> = {}): ReporterCase {
  return {
    id: "case-1",
    caseReference: "JN-2026-0001",
    title: "Denied entry to a public office",
    category: "Discrimination",
    incidentDate: "2026-09-01",
    status: "submitted",
    createdAt: "2026-09-02T08:00:00.000Z",
    updatedAt: "2026-09-03T10:30:00.000Z",
    ...overrides,
  };
}

export function makeEvidenceFile(
  overrides: Partial<PendingEvidenceFile> = {},
): PendingEvidenceFile {
  return {
    localId: "local-1",
    uri: "file:///cache/photo.jpg",
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    category: "photo",
    description: "",
    ...overrides,
  };
}
