import {
  filterReporterCases,
  formatCaseDate,
  formatCaseDateTime,
} from "../../src/reporter/cases/filterReporterCases";
import {
  ACTIVE_STATUSES,
  RESOLVED_STATUSES,
  ReporterCaseStatus,
  STATUS_FILTERS,
  WAITING_STATUSES,
} from "../../src/reporter/cases/types";
import { makeCase } from "../helpers/fixtures";

const cases = [
  makeCase({ id: "1", caseReference: "JN-2026-0001", status: "submitted", title: "Unlawful arrest", category: "Unlawful Detention" }),
  makeCase({ id: "2", caseReference: "JN-2026-0002", status: "investigating", title: "Workplace abuse", category: "Workplace Rights Violation" }),
  makeCase({ id: "3", caseReference: "JN-2026-0003", status: "awaiting_information", title: "School exclusion", category: "Child Rights Violation" }),
  makeCase({ id: "4", caseReference: "JN-2026-0004", status: "withdrawal_requested", title: "Police threat", category: "Harassment" }),
  makeCase({ id: "5", caseReference: "JN-2026-0005", status: "resolved", title: "Denied service", category: "Discrimination" }),
  makeCase({ id: "6", caseReference: "JN-2026-0006", status: "closed", title: "Old complaint", category: "Other" }),
];

function ids(tab: "all" | "active" | "waiting" | "resolved", status: "all" | ReporterCaseStatus = "all", query = "") {
  return filterReporterCases(cases, { tab, status, query }).map((item) => item.id);
}

describe("JN-78 My cases - status groups", () => {
  it("places every status in exactly one tab group", () => {
    const grouped = [...ACTIVE_STATUSES, ...WAITING_STATUSES, ...RESOLVED_STATUSES];
    const allStatuses = STATUS_FILTERS.filter((f) => f.value !== "all").map((f) => f.value);

    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...allStatuses].sort());
  });
});

describe("JN-78 My cases - filterReporterCases()", () => {
  it("shows every case on the All tab", () => {
    expect(ids("all")).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("shows only active cases on the Active tab", () => {
    expect(ids("active")).toEqual(["1", "2"]);
  });

  it("shows cases waiting on the reporter or a withdrawal on the Waiting tab", () => {
    expect(ids("waiting")).toEqual(["3", "4"]);
  });

  it("shows resolved and closed cases on the Resolved tab", () => {
    expect(ids("resolved")).toEqual(["5", "6"]);
  });

  it("filters by a specific status", () => {
    expect(ids("all", "investigating")).toEqual(["2"]);
  });

  it("combines the tab and status filters", () => {
    expect(ids("active", "resolved")).toEqual([]);
    expect(ids("resolved", "closed")).toEqual(["6"]);
  });

  it.each([
    ["JN-2026-0003", ["3"]],
    ["workplace", ["2"]],
    ["DISCRIMINATION", ["5"]],
    ["  arrest  ", ["1"]],
    ["no match", []],
  ])("searches reference, title and category for %p", (query, expected) => {
    expect(ids("all", "all", query)).toEqual(expected);
  });

  it("ignores a blank search", () => {
    expect(ids("all", "all", "   ")).toHaveLength(6);
  });

  it("does not modify the original list", () => {
    const copy = [...cases];
    filterReporterCases(cases, { tab: "active", status: "all", query: "x" });
    expect(cases).toEqual(copy);
  });
});

describe("JN-78 My cases - date formatting", () => {
  it("shows a placeholder when no date is recorded", () => {
    expect(formatCaseDate(null)).toBe("Date not recorded");
  });

  it("returns invalid dates unchanged", () => {
    expect(formatCaseDate("not a date")).toBe("not a date");
    expect(formatCaseDateTime("not a date")).toBe("not a date");
  });

  it("formats valid dates as a readable date", () => {
    const formatted = formatCaseDate("2026-09-01");

    expect(formatted).toContain("2026");
    expect(formatted).not.toBe("2026-09-01");
  });

  it("includes the time for date-times", () => {
    const formatted = formatCaseDateTime("2026-09-03T10:30:00.000Z");

    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
