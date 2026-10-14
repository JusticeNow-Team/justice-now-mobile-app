import { updateReporterProfile } from "../../src/reporter/profile/updateReporterProfile";
import {
  callsOf,
  mockSignedInUser,
  queriesFor,
  queueTable,
  supabase,
} from "../mocks/supabaseClient";

const input = {
  fullName: "  Nimali Perera ",
  phone: " +94 77 123 4567 ",
  preferredLanguage: "si" as const,
  allowCaseContact: false,
};

describe("JN-50 Update reporter profile - updateReporterProfile()", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(updateReporterProfile(input)).resolves.toEqual({
      ok: false,
      message: "Please sign in to update your profile.",
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("saves trimmed values to the reporter's own profile row and auth metadata", async () => {
    mockSignedInUser({ id: "reporter-1", email: "nimali@example.com" });
    queueTable("profiles", { data: { id: "reporter-1", role: "reporter" } }, {});

    await expect(updateReporterProfile(input)).resolves.toEqual({ ok: true });

    const [, updateQuery] = queriesFor("profiles");
    expect(callsOf(updateQuery, "update")).toEqual([
      [
        {
          full_name: "Nimali Perera",
          phone: "+94 77 123 4567",
          preferred_language: "si",
          allow_case_contact: false,
        },
      ],
    ]);
    expect(callsOf(updateQuery, "eq")).toEqual([
      ["id", "reporter-1"],
      ["role", "reporter"],
    ]);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        full_name: "Nimali Perera",
        phone: "+94 77 123 4567",
        preferred_language: "si",
        allow_case_contact: false,
      },
    });
  });

  it("refuses to update when the profile cannot be verified", async () => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable("profiles", { error: { message: "fail" } });

    await expect(updateReporterProfile(input)).resolves.toEqual({
      ok: false,
      message: "JusticeNow could not verify your profile.",
    });
    expect(queriesFor("profiles")).toHaveLength(1);
  });

  it.each([
    [{ id: "reporter-1", role: "case_officer" }],
    [{ id: "someone-else", role: "reporter" }],
  ])("refuses to update a profile that is not the reporter's own: %p", async (row) => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable("profiles", { data: row });

    await expect(updateReporterProfile(input)).resolves.toEqual({
      ok: false,
      message: "You can only update your own reporter profile.",
    });
    expect(queriesFor("profiles")).toHaveLength(1);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("falls back to saving only the name when the full update fails", async () => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable(
      "profiles",
      { data: { id: "reporter-1", role: "reporter" } },
      { error: { message: "column phone does not exist" } },
      {},
    );

    await expect(updateReporterProfile(input)).resolves.toEqual({ ok: true });

    const fallbackQuery = queriesFor("profiles")[2];
    expect(callsOf(fallbackQuery, "update")).toEqual([[{ full_name: "Nimali Perera" }]]);
  });

  it("returns the original error when both updates fail", async () => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable(
      "profiles",
      { data: { id: "reporter-1", role: "reporter" } },
      { error: { message: "Row level security violation" } },
      { error: { message: "still failing" } },
    );

    await expect(updateReporterProfile(input)).resolves.toEqual({
      ok: false,
      message: "Row level security violation",
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("warns when the profile saved but auth metadata did not", async () => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable("profiles", { data: { id: "reporter-1", role: "reporter" } }, {});
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: "fail" } });

    await expect(updateReporterProfile(input)).resolves.toEqual({
      ok: false,
      message:
        "Your profile was saved, but account details could not be fully updated. Please try again.",
    });
  });
});
