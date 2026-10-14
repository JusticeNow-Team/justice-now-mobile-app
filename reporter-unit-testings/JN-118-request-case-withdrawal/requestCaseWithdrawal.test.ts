import {
  canRequestWithdrawal,
  requestCaseWithdrawal,
} from "../../src/reporter/cases/requestCaseWithdrawal";
import { ReporterCaseStatus } from "../../src/reporter/cases/types";
import {
  callsOf,
  mockProfileRole,
  mockSignedInUser,
  queriesFor,
  queueTable,
  supabase,
} from "../mocks/supabaseClient";

const REASON = "  The matter was resolved with my employer.  ";

function signInReporterWithCase(status: ReporterCaseStatus = "investigating") {
  mockSignedInUser({ id: "reporter-1" });
  mockProfileRole("reporter");
  queueTable("cases", { data: { id: "case-1", status, reporter_id: "reporter-1" } });
}

describe("JN-118 Case withdrawal - canRequestWithdrawal()", () => {
  it.each(["submitted", "under_review", "assigned", "investigating", "awaiting_information", "awaiting_evidence"] as const)(
    "allows a withdrawal for a %s case",
    (status) => {
      expect(canRequestWithdrawal(status)).toBe(true);
    },
  );

  it.each(["resolved", "closed", "withdrawal_requested"] as const)(
    "blocks a withdrawal for a %s case",
    (status) => {
      expect(canRequestWithdrawal(status)).toBe(false);
    },
  );
});

describe("JN-118 Case withdrawal - reason validation", () => {
  it("requires at least 10 characters after trimming", async () => {
    await expect(
      requestCaseWithdrawal({ caseId: "case-1", reason: "   too short " }),
    ).resolves.toEqual({
      ok: false,
      reason: "validation",
      message: "Please explain why you want to withdraw this case (at least 10 characters).",
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("rejects reasons longer than 1000 characters", async () => {
    await expect(
      requestCaseWithdrawal({ caseId: "case-1", reason: "a".repeat(1001) }),
    ).resolves.toEqual({
      ok: false,
      reason: "validation",
      message: "Keep your withdrawal reason within 1000 characters.",
    });
  });
});

describe("JN-118 Case withdrawal - access checks", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to request a withdrawal.",
    });
  });

  it("blocks non-reporter accounts", async () => {
    mockSignedInUser({ id: "officer-1" });
    mockProfileRole("case_officer");

    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Only a signed-in reporter can request case withdrawal.",
    });
  });

  it("blocks a case that belongs to another reporter", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { data: null });

    await expect(requestCaseWithdrawal({ caseId: "case-9", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "This case does not belong to your account.",
    });
    expect(callsOf(queriesFor("cases")[0], "eq")).toEqual([
      ["id", "case-9"],
      ["reporter_id", "reporter-1"],
    ]);
  });

  it.each(["resolved", "closed"] as const)("refuses to withdraw a %s case", async (status) => {
    signInReporterWithCase(status);

    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "Resolved or closed cases cannot be withdrawn.",
    });
    expect(queriesFor("case_withdrawal_requests")).toHaveLength(0);
  });

  it("refuses a second request while the case is already withdrawal_requested", async () => {
    signInReporterWithCase("withdrawal_requested");

    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "A withdrawal request is already pending for this case.",
    });
  });

  it("refuses when a pending withdrawal request already exists", async () => {
    signInReporterWithCase("investigating");
    queueTable("case_withdrawal_requests", { data: { id: "wd-1", status: "pending" } });

    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "A withdrawal request is already pending for this case.",
    });

    const [lookup] = queriesFor("case_withdrawal_requests");
    expect(callsOf(lookup, "in")).toEqual([["status", ["requested", "pending"]]]);
    expect(queriesFor("case_withdrawal_requests")).toHaveLength(1);
  });
});

describe("JN-118 Case withdrawal - submitting the request", () => {
  it("records the request, updates the case and writes status history", async () => {
    signInReporterWithCase("investigating");

    const result = await requestCaseWithdrawal({ caseId: "case-1", reason: REASON });

    expect(result).toEqual({ ok: true, requestedAt: expect.any(String) });
    const requestedAt = result.ok ? result.requestedAt : "";
    expect(new Date(requestedAt).toISOString()).toBe(requestedAt);

    const insertRequest = queriesFor("case_withdrawal_requests")[1];
    expect(callsOf(insertRequest, "insert")).toEqual([
      [
        {
          case_id: "case-1",
          reporter_id: "reporter-1",
          reason: "The matter was resolved with my employer.",
          status: "requested",
          requested_at: requestedAt,
        },
      ],
    ]);

    const updateCase = queriesFor("cases")[1];
    expect(callsOf(updateCase, "update")).toEqual([
      [{ status: "withdrawal_requested", updated_at: requestedAt }],
    ]);
    expect(callsOf(updateCase, "eq")).toEqual([
      ["id", "case-1"],
      ["reporter_id", "reporter-1"],
    ]);

    expect(callsOf(queriesFor("case_status_history")[0], "insert")).toEqual([
      [
        {
          case_id: "case-1",
          old_status: "investigating",
          new_status: "withdrawal_requested",
          changed_at: requestedAt,
        },
      ],
    ]);
  });

  it.each([
    ['relation "case_withdrawal_requests" does not exist', "Withdrawal requests are not available on the server yet. Please try again later."],
    ["Could not find the table in the schema cache", "Withdrawal requests are not available on the server yet. Please try again later."],
    ["new row violates check constraint", "This case status cannot be set to withdrawal requested yet. Please contact support."],
    ["duplicate key value violates unique constraint", "A withdrawal request is already recorded for this case."],
    ["Row level security", "Row level security"],
  ])("maps the insert error %p", async (dbMessage, expected) => {
    signInReporterWithCase("investigating");
    queueTable("case_withdrawal_requests", { data: null }, { error: { message: dbMessage } });

    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: expected,
    });
    expect(queriesFor("cases")).toHaveLength(1);
  });

  it("reports when the case status cannot be updated", async () => {
    signInReporterWithCase("investigating");
    queueTable("cases", { error: { message: 'invalid input value for enum case_status' } });

    await expect(requestCaseWithdrawal({ caseId: "case-1", reason: REASON })).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "This case status cannot be set to withdrawal requested yet. Please contact support.",
    });
    expect(queriesFor("case_status_history")).toHaveLength(0);
  });
});
