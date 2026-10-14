import { submitReporterCase } from "../../src/reporter/report/submitReporterCase";
import { makeDraft } from "../helpers/fixtures";
import {
  mockProfileRole,
  mockSignedInUser,
  supabase,
} from "../mocks/supabaseClient";

const savedCase = {
  id: "case-123",
  case_reference: "JN-2026-0042",
  created_at: "2026-10-14T06:00:00.000Z",
};

function rpcArgs(callIndex = 0) {
  return supabase.rpc.mock.calls[callIndex][1];
}

describe("JN-67 Submit a case - signed-in reporter", () => {
  beforeEach(() => {
    mockSignedInUser({ id: "reporter-1", email: "nimali@example.com" });
  });

  it("submits a standard case through submit_reporter_case_v2", async () => {
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: [savedCase], error: null });

    const result = await submitReporterCase(
      makeDraft({
        title: "  Denied entry  ",
        categories: ["discrimination", "violence_or_abuse"],
      }),
    );

    expect(result).toEqual({
      ok: true,
      id: "case-123",
      caseReference: "JN-2026-0042",
      submittedAt: "2026-10-14T06:00:00.000Z",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc.mock.calls[0][0]).toBe("submit_reporter_case_v2");
    expect(rpcArgs()).toMatchObject({
      p_title: "Denied entry",
      p_category: "Discrimination; Violence or Abuse",
      p_incident_date: "2026-09-01",
      p_district: "Colombo",
      p_is_anonymous: false,
      p_priority: "medium",
      p_submission_channel: "standard",
    });
  });

  it("accepts an RPC that returns a single object instead of an array", async () => {
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: savedCase, error: null });

    await expect(submitReporterCase(makeDraft())).resolves.toMatchObject({
      ok: true,
      caseReference: "JN-2026-0042",
    });
  });

  it("marks instant reports as urgent", async () => {
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: [savedCase], error: null });

    await submitReporterCase(makeDraft({ isInstantReport: true }));

    expect(rpcArgs()).toMatchObject({
      p_priority: "urgent",
      p_submission_channel: "instant",
    });
  });

  it("flags a signed-in anonymous report as anonymous", async () => {
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: [savedCase], error: null });

    await submitReporterCase(makeDraft({ reportingMode: "anonymous" }));

    expect(supabase.rpc.mock.calls[0][0]).toBe("submit_reporter_case_v2");
    expect(rpcArgs().p_is_anonymous).toBe(true);
  });

  it("falls back to the legacy RPC when v2 fails for a standard report", async () => {
    mockProfileRole("reporter");
    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "function does not exist" } })
      .mockResolvedValueOnce({ data: [savedCase], error: null });

    await expect(submitReporterCase(makeDraft())).resolves.toMatchObject({ ok: true });

    expect(supabase.rpc.mock.calls[1][0]).toBe("submit_reporter_case");
    expect(rpcArgs(1)).toEqual({
      p_title: "Denied entry to a public office",
      p_description: expect.any(String),
      p_category: "Discrimination",
      p_incident_date: "2026-09-01",
      p_district: "Colombo",
      p_is_anonymous: false,
    });
  });

  it("does not fall back for an instant report", async () => {
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "v2 failed" } });

    await expect(submitReporterCase(makeDraft({ isInstantReport: true }))).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "v2 failed",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a generic error when nothing is saved", async () => {
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(submitReporterCase(makeDraft())).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "JusticeNow could not save your case. Please try again.",
    });
  });

  it("refuses staff accounts", async () => {
    mockProfileRole("case_officer");

    await expect(submitReporterCase(makeDraft())).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Only a signed-in Reporter can submit a case.",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("JN-67 Submit a case - case description sent to staff", () => {
  beforeEach(() => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    supabase.rpc.mockResolvedValue({ data: [savedCase], error: null });
  });

  async function submittedDescription(overrides = {}) {
    await submitReporterCase(makeDraft(overrides));
    return rpcArgs().p_description as string;
  }

  it("includes the story, location, affected person and privacy choices", async () => {
    const description = await submittedDescription({
      description: "  What happened.  ",
      incidentTime: "14:30",
      ongoing: "yes",
      city: "Maradana",
      specificLocation: "Main Street",
      victimRelation: "other",
      victimName: "Kamal",
      victimAge: "18–24",
      victimGender: "Male",
      victimContact: "0771234567",
      victimRelationship: "Brother",
      hideIdentity: true,
      allowContact: false,
      discreetNotifications: true,
      contactMethod: "email",
    });

    expect(description.split("\n")).toEqual([
      "What happened.",
      "",
      "--- Additional details ---",
      "Approximate time: 14:30",
      "Still ongoing: yes",
      "Province: Western Province",
      "District: Colombo",
      "City or area: Maradana",
      "Specific location: Main Street",
      "Reporting as: For another person",
      "Affected person name: Kamal",
      "Approximate age: 18–24",
      "Gender: Male",
      "Affected person contact: 0771234567",
      "Relationship: Brother",
      "Hide identity from selected parties: Yes",
      "Investigator may contact: No",
      "Discreet notifications: Yes",
      "Preferred contact: email",
    ]);
  });

  it("withholds the exact location when the reporter hides it", async () => {
    const description = await submittedDescription({
      hideExactLocation: true,
      specificLocation: "12 Secret Lane",
    });

    expect(description).toContain("Exact location: withheld");
    expect(description).not.toContain("12 Secret Lane");
  });

  it("lists witnesses and hides missing names", async () => {
    const description = await submittedDescription({
      witnesses: [
        { name: "Saman", contact: "", seen: "Saw the guard" },
        { name: "", contact: "", seen: "" },
      ],
    });

    expect(description).toContain("Witnesses: 2");
    expect(description).toContain("Witness 1: Saman · Saw the guard");
    expect(description).toContain("Witness 2: Name withheld · No description");
  });

  it("describes a self report as from the affected person", async () => {
    expect(await submittedDescription({ victimRelation: "self" })).toContain(
      "Reporting as: The affected person",
    );
  });
});

describe("JN-67 Submit a case - anonymous reporter without an account", () => {
  it("asks a signed-out identified reporter to sign in", async () => {
    await expect(submitReporterCase(makeDraft({ reportingMode: "identified" }))).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to submit a case.",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("submits through the anonymous RPC without touching the profiles table", async () => {
    supabase.rpc.mockResolvedValue({ data: [savedCase], error: null });

    const result = await submitReporterCase(makeDraft({ reportingMode: "anonymous" }));

    expect(result).toMatchObject({ ok: true, id: "case-123" });
    expect(supabase.rpc.mock.calls[0][0]).toBe("submit_anonymous_reporter_case");
    expect(rpcArgs()).toMatchObject({
      p_priority: "medium",
      p_submission_channel: "anonymous",
    });
    expect(rpcArgs()).not.toHaveProperty("p_is_anonymous");
    expect(supabase.from).not.toHaveBeenCalledWith("profiles");
  });

  it("marks an anonymous instant report as urgent", async () => {
    supabase.rpc.mockResolvedValue({ data: [savedCase], error: null });

    await submitReporterCase(makeDraft({ reportingMode: "anonymous", isInstantReport: true }));

    expect(rpcArgs()).toMatchObject({
      p_priority: "urgent",
      p_submission_channel: "instant_anonymous",
    });
  });

  it("reports anonymous submission failures", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(submitReporterCase(makeDraft({ reportingMode: "anonymous" }))).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "JusticeNow could not save your anonymous case. Please try again.",
    });
  });
});
