import { asStatus, getReporterCases } from "../../src/reporter/cases/getReporterCases";
import {
  callsOf,
  mockProfileRole,
  mockSignedInUser,
  queriesFor,
  queueTable,
  supabase,
} from "../mocks/supabaseClient";

const row = {
  id: "case-1",
  case_reference: "JN-2026-0001",
  title: "Unlawful arrest",
  category: "Unlawful Detention",
  incident_date: "2026-09-01",
  status: "investigating",
  created_at: "2026-09-02T08:00:00.000Z",
  updated_at: "2026-09-03T10:30:00.000Z",
  reporter_id: "reporter-1",
};

describe("JN-78 My cases - asStatus()", () => {
  it("keeps known statuses", () => {
    expect(asStatus("awaiting_evidence")).toBe("awaiting_evidence");
    expect(asStatus("closed")).toBe("closed");
  });

  it("falls back to submitted for unknown statuses", () => {
    expect(asStatus("archived")).toBe("submitted");
    expect(asStatus("")).toBe("submitted");
  });
});

describe("JN-78 My cases - getReporterCases()", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(getReporterCases()).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to view your cases.",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("blocks staff accounts", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("evidence_checker");

    await expect(getReporterCases()).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "This area is only available to reporter accounts.",
    });
    expect(queriesFor("cases")).toHaveLength(0);
  });

  it("loads only the reporter's own cases, newest update first", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { data: [row] });

    const result = await getReporterCases();

    expect(result).toEqual({
      ok: true,
      cases: [
        {
          id: "case-1",
          caseReference: "JN-2026-0001",
          title: "Unlawful arrest",
          category: "Unlawful Detention",
          incidentDate: "2026-09-01",
          status: "investigating",
          createdAt: "2026-09-02T08:00:00.000Z",
          updatedAt: "2026-09-03T10:30:00.000Z",
        },
      ],
    });

    const [casesQuery] = queriesFor("cases");
    expect(callsOf(casesQuery, "eq")).toEqual([["reporter_id", "reporter-1"]]);
    expect(callsOf(casesQuery, "order")).toEqual([["updated_at", { ascending: false }]]);
  });

  it("drops any row that belongs to another reporter", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", {
      data: [row, { ...row, id: "case-2", reporter_id: "someone-else" }],
    });

    const result = await getReporterCases();

    expect(result.ok && result.cases.map((c) => c.id)).toEqual(["case-1"]);
  });

  it("normalises unknown statuses to submitted", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { data: [{ ...row, status: "triage" }] });

    const result = await getReporterCases();

    expect(result.ok && result.cases[0].status).toBe("submitted");
  });

  it("returns an empty list when the reporter has no cases", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { data: null });

    await expect(getReporterCases()).resolves.toEqual({ ok: true, cases: [] });
  });

  it("returns the database error message", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { error: { message: "permission denied for table cases" } });

    await expect(getReporterCases()).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "permission denied for table cases",
    });
  });
});
