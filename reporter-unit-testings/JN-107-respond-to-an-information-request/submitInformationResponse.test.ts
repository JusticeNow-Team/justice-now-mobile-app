import { submitInformationResponse } from "../../src/reporter/cases/submitInformationResponse";
import {
  callsOf,
  mockProfileRole,
  mockSignedInUser,
  queriesFor,
  queueTable,
  supabase,
} from "../mocks/supabaseClient";

const input = {
  requestId: "req-1",
  caseId: "case-1",
  requestedItems: ["Time of arrest", "Names of officers"],
  responseText: "  Around 9pm. I did not see name badges.  ",
};

function signInReporterWithOpenRequest() {
  mockSignedInUser({ id: "reporter-1" });
  mockProfileRole("reporter");
  queueTable("case_information_requests", { data: { id: "req-1", status: "sent" } });
}

describe("JN-107 Respond to an information request - input validation", () => {
  it("requires a response", async () => {
    await expect(submitInformationResponse({ ...input, responseText: "   " })).resolves.toEqual({
      ok: false,
      reason: "validation",
      message: "Write your response before submitting.",
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("accepts exactly 2000 characters and rejects more", async () => {
    signInReporterWithOpenRequest();
    await expect(
      submitInformationResponse({ ...input, responseText: "a".repeat(2000) }),
    ).resolves.toEqual({ ok: true });

    await expect(
      submitInformationResponse({ ...input, responseText: "a".repeat(2001) }),
    ).resolves.toEqual({
      ok: false,
      reason: "validation",
      message: "Keep your response within 2000 characters.",
    });
  });
});

describe("JN-107 Respond to an information request - access checks", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(submitInformationResponse(input)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to submit your response.",
    });
  });

  it("blocks non-reporter accounts", async () => {
    mockSignedInUser({ id: "officer-1" });
    mockProfileRole("case_officer");

    await expect(submitInformationResponse(input)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Only a signed-in reporter can respond to information requests.",
    });
  });

  it("only accepts an open request on the reporter's own case", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("case_information_requests", { data: null });

    await expect(submitInformationResponse(input)).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "This information request is not open for a response.",
    });

    expect(callsOf(queriesFor("case_information_requests")[0], "eq")).toEqual([
      ["id", "req-1"],
      ["case_id", "case-1"],
      ["reporter_id", "reporter-1"],
      ["status", "sent"],
    ]);
    expect(queriesFor("case_information_responses")).toHaveLength(0);
  });
});

describe("JN-107 Respond to an information request - saving the response", () => {
  it("saves the response and marks the request as responded", async () => {
    signInReporterWithOpenRequest();

    await expect(submitInformationResponse(input)).resolves.toEqual({ ok: true });

    const [insertQuery] = queriesFor("case_information_responses");
    const [[inserted]] = callsOf(insertQuery, "insert") as [[Record<string, unknown>]];
    expect(inserted).toEqual({
      request_id: "req-1",
      case_id: "case-1",
      reporter_id: "reporter-1",
      answers: [
        { question: "Time of arrest", answer: "Around 9pm. I did not see name badges." },
        { question: "Names of officers", answer: "Around 9pm. I did not see name badges." },
      ],
      additional_message: "Around 9pm. I did not see name badges.",
      submitted_at: expect.any(String),
    });

    const updateQuery = queriesFor("case_information_requests")[1];
    expect(callsOf(updateQuery, "update")).toEqual([
      [
        {
          status: "responded",
          responded_at: inserted.submitted_at,
          updated_at: inserted.submitted_at,
        },
      ],
    ]);
    expect(callsOf(updateQuery, "eq")).toEqual([
      ["id", "req-1"],
      ["reporter_id", "reporter-1"],
      ["status", "sent"],
    ]);
  });

  it("saves an empty answer list when no specific items were requested", async () => {
    signInReporterWithOpenRequest();

    await submitInformationResponse({ ...input, requestedItems: [] });

    const [[inserted]] = callsOf(queriesFor("case_information_responses")[0], "insert") as [
      [Record<string, unknown>],
    ];
    expect(inserted.answers).toEqual([]);
  });

  it("reports when the response cannot be saved", async () => {
    signInReporterWithOpenRequest();
    queueTable("case_information_responses", { error: { message: "duplicate key value" } });

    await expect(submitInformationResponse(input)).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "duplicate key value",
    });
    expect(queriesFor("case_information_requests")).toHaveLength(1);
  });

  it("reports when the request status cannot be updated", async () => {
    signInReporterWithOpenRequest();
    queueTable("case_information_requests", { error: { message: "" } });

    await expect(submitInformationResponse(input)).resolves.toEqual({
      ok: false,
      reason: "generic",
      message:
        "Your response was saved, but the request status could not be updated. Please contact support if this persists.",
    });
  });
});
