import {
  formatEvidenceSize,
  getReporterCaseDetail,
} from "../../src/reporter/cases/getReporterCaseDetail";
import {
  callsOf,
  mockProfileRole,
  mockSignedInUser,
  queriesFor,
  queueTable,
  supabase,
} from "../mocks/supabaseClient";

const caseRow = {
  id: "case-1",
  reporter_id: "reporter-1",
  case_reference: "JN-2026-0001",
  title: "Unlawful arrest",
  description: "Taken without a warrant.",
  category: "Unlawful Detention",
  incident_date: "2026-09-01",
  district: "Colombo",
  status: "awaiting_information",
  is_anonymous: 0,
  created_at: "2026-09-02T08:00:00.000Z",
  updated_at: "2026-09-03T10:30:00.000Z",
};

function signInReporterWithCase(row: Record<string, unknown> | null = caseRow) {
  mockSignedInUser({ id: "reporter-1" });
  mockProfileRole("reporter");
  queueTable("cases", { data: row });
}

describe("JN-88 Case details - formatEvidenceSize()", () => {
  it.each([
    [null, "Size unknown"],
    [0, "Size unknown"],
    [-5, "Size unknown"],
    [512, "512 B"],
    [2048, "2.0 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
  ])("formats %p as %p", (bytes, expected) => {
    expect(formatEvidenceSize(bytes)).toBe(expected);
  });
});

describe("JN-88 Case details - access control", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(getReporterCaseDetail("case-1")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to view this case.",
    });
  });

  it("blocks staff accounts", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("system_admin");

    await expect(getReporterCaseDetail("case-1")).resolves.toMatchObject({
      ok: false,
      reason: "unauthenticated",
    });
    expect(queriesFor("cases")).toHaveLength(0);
  });

  it("only looks up the case within the reporter's own cases", async () => {
    signInReporterWithCase();

    await getReporterCaseDetail("case-1");

    expect(callsOf(queriesFor("cases")[0], "eq")).toEqual([
      ["id", "case-1"],
      ["reporter_id", "reporter-1"],
    ]);
  });

  it("refuses a case that is not on the reporter's account", async () => {
    signInReporterWithCase(null);

    await expect(getReporterCaseDetail("case-x")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "This case is not available on your account.",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("refuses a returned row owned by a different reporter", async () => {
    signInReporterWithCase({ ...caseRow, reporter_id: "someone-else" });

    await expect(getReporterCaseDetail("case-1")).resolves.toMatchObject({
      ok: false,
      reason: "forbidden",
    });
  });

  it("returns the case query error", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { error: { message: "timeout" } });

    await expect(getReporterCaseDetail("case-1")).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "timeout",
    });
  });
});

describe("JN-88 Case details - loaded detail", () => {
  it("returns the case, officer, evidence, history, requests and withdrawal", async () => {
    signInReporterWithCase();
    supabase.rpc.mockResolvedValue({
      data: [{ full_name: "K. Silva", role_label: "Lead investigator" }],
      error: null,
    });
    queueTable("case_evidence", {
      data: [
        {
          id: "ev-1",
          title: "Photo of injury",
          file_name: "injury.jpg",
          evidence_type: "image",
          file_size_bytes: 2048,
          validation_status: "pending",
          created_at: "2026-09-04T00:00:00.000Z",
        },
      ],
    });
    queueTable("case_status_history", {
      data: [
        { id: "h-1", old_status: null, new_status: "submitted", changed_at: "2026-09-02T08:00:00.000Z" },
        { id: "h-2", old_status: "submitted", new_status: "awaiting_information", changed_at: "2026-09-03T10:30:00.000Z" },
      ],
    });
    queueTable("case_information_requests", {
      data: [
        {
          id: "req-1",
          title: "Need arrest time",
          message: "When were you arrested?",
          requested_items: ["Time of arrest"],
          requires_evidence: 1,
          due_date: "2026-10-20",
          status: "responded",
          sent_at: "2026-09-03T10:30:00.000Z",
          case_information_responses: [
            {
              id: "resp-1",
              answers: [
                { question: "Time of arrest", answer: "Around 9pm" },
                { question: 42, answer: "invalid row" },
                null,
              ],
              additional_message: "Around 9pm",
              submitted_at: "2026-09-05T00:00:00.000Z",
            },
          ],
        },
        {
          id: "req-2",
          title: "Witness names",
          message: "Any witnesses?",
          requested_items: null,
          requires_evidence: false,
          due_date: null,
          status: "sent",
          sent_at: "2026-09-06T00:00:00.000Z",
          case_information_responses: null,
        },
      ],
    });
    queueTable("case_withdrawal_requests", {
      data: {
        id: "wd-1",
        reason: "Settled privately",
        status: "rejected",
        requested_at: "2026-09-07T00:00:00.000Z",
        reviewed_at: "2026-09-08T00:00:00.000Z",
        decision_reason: "Evidence of ongoing risk",
      },
    });

    const result = await getReporterCaseDetail("case-1");

    expect(result).toEqual({
      ok: true,
      detail: {
        id: "case-1",
        caseReference: "JN-2026-0001",
        title: "Unlawful arrest",
        description: "Taken without a warrant.",
        category: "Unlawful Detention",
        incidentDate: "2026-09-01",
        district: "Colombo",
        status: "awaiting_information",
        isAnonymous: false,
        createdAt: "2026-09-02T08:00:00.000Z",
        updatedAt: "2026-09-03T10:30:00.000Z",
      },
      officer: { fullName: "K. Silva", roleLabel: "Lead investigator" },
      evidence: [
        {
          id: "ev-1",
          title: "Photo of injury",
          fileName: "injury.jpg",
          evidenceType: "image",
          fileSizeBytes: 2048,
          validationStatus: "pending",
          createdAt: "2026-09-04T00:00:00.000Z",
        },
      ],
      history: [
        { id: "h-1", fromStatus: null, toStatus: "submitted", changedAt: "2026-09-02T08:00:00.000Z" },
        { id: "h-2", fromStatus: "submitted", toStatus: "awaiting_information", changedAt: "2026-09-03T10:30:00.000Z" },
      ],
      informationRequests: [
        {
          id: "req-1",
          title: "Need arrest time",
          message: "When were you arrested?",
          requestedItems: ["Time of arrest"],
          requiresEvidence: true,
          dueDate: "2026-10-20",
          status: "responded",
          sentAt: "2026-09-03T10:30:00.000Z",
          response: {
            id: "resp-1",
            answers: [{ question: "Time of arrest", answer: "Around 9pm" }],
            additionalMessage: "Around 9pm",
            submittedAt: "2026-09-05T00:00:00.000Z",
          },
        },
        {
          id: "req-2",
          title: "Witness names",
          message: "Any witnesses?",
          requestedItems: [],
          requiresEvidence: false,
          dueDate: null,
          status: "sent",
          sentAt: "2026-09-06T00:00:00.000Z",
          response: null,
        },
      ],
      withdrawalRequest: {
        id: "wd-1",
        reason: "Settled privately",
        status: "rejected",
        requestedAt: "2026-09-07T00:00:00.000Z",
        reviewedAt: "2026-09-08T00:00:00.000Z",
        decisionReason: "Evidence of ongoing risk",
      },
    });

    expect(supabase.rpc).toHaveBeenCalledWith("get_reporter_case_officer_public", {
      p_case_id: "case-1",
    });
  });

  it("scopes information and withdrawal requests to the reporter", async () => {
    signInReporterWithCase();

    await getReporterCaseDetail("case-1");

    const [requestsQuery] = queriesFor("case_information_requests");
    expect(callsOf(requestsQuery, "eq")).toEqual([
      ["case_id", "case-1"],
      ["reporter_id", "reporter-1"],
    ]);
    expect(callsOf(requestsQuery, "in")).toEqual([["status", ["sent", "responded"]]]);

    const [withdrawalQuery] = queriesFor("case_withdrawal_requests");
    expect(callsOf(withdrawalQuery, "eq")).toEqual([
      ["case_id", "case-1"],
      ["reporter_id", "reporter-1"],
    ]);
    expect(callsOf(withdrawalQuery, "limit")).toEqual([[1]]);
  });

  it("returns empty sections when nothing else is recorded yet", async () => {
    signInReporterWithCase({ ...caseRow, status: "submitted", is_anonymous: true });

    const result = await getReporterCaseDetail("case-1");

    expect(result).toMatchObject({
      ok: true,
      detail: { status: "submitted", isAnonymous: true },
      officer: null,
      evidence: [],
      history: [],
      informationRequests: [],
      withdrawalRequest: null,
    });
  });

  it("uses a default role label for the assigned officer", async () => {
    signInReporterWithCase();
    supabase.rpc.mockResolvedValue({ data: { full_name: "K. Silva", role_label: null }, error: null });

    const result = await getReporterCaseDetail("case-1");

    expect(result.ok && result.officer).toEqual({
      fullName: "K. Silva",
      roleLabel: "Assigned investigator",
    });
  });

  it("fails when information requests cannot be loaded", async () => {
    signInReporterWithCase();
    queueTable("case_information_requests", { error: { message: "rls denied" } });

    await expect(getReporterCaseDetail("case-1")).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "rls denied",
    });
  });
});
