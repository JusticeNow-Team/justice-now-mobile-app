import { getReporterProfile } from "../../src/reporter/profile/getReporterProfile";
import {
  callsOf,
  mockSignedInUser,
  queriesFor,
  queueTable,
} from "../mocks/supabaseClient";

const user = {
  id: "reporter-1",
  email: "nimali@example.com",
  user_metadata: {
    phone: "+94 71 000 0000",
    preferred_language: "ta",
    allow_case_contact: false,
  },
};

describe("JN-50 View reporter profile - getReporterProfile()", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(getReporterProfile()).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to view your profile.",
    });
  });

  it("loads the signed-in reporter's own profile row", async () => {
    mockSignedInUser(user);
    queueTable("profiles", {
      data: {
        id: "reporter-1",
        full_name: "Nimali Perera",
        role: "reporter",
        phone: "+94 77 123 4567",
        preferred_language: "si",
        allow_case_contact: true,
      },
    });

    await expect(getReporterProfile()).resolves.toEqual({
      ok: true,
      profile: {
        id: "reporter-1",
        fullName: "Nimali Perera",
        email: "nimali@example.com",
        phone: "+94 77 123 4567",
        preferredLanguage: "si",
        allowCaseContact: true,
        role: "reporter",
      },
    });

    expect(callsOf(queriesFor("profiles")[0], "eq")).toEqual([["id", "reporter-1"]]);
  });

  it("falls back to auth metadata for empty profile columns", async () => {
    mockSignedInUser(user);
    queueTable("profiles", {
      data: {
        id: "reporter-1",
        full_name: null,
        role: "reporter",
        phone: "",
        preferred_language: null,
        allow_case_contact: null,
      },
    });

    const result = await getReporterProfile();

    expect(result).toMatchObject({
      ok: true,
      profile: {
        fullName: "",
        phone: "+94 71 000 0000",
        preferredLanguage: "ta",
        allowCaseContact: false,
      },
    });
  });

  it("defaults to English and allows contact when nothing is stored", async () => {
    mockSignedInUser({ id: "reporter-1", email: "nimali@example.com" });
    queueTable("profiles", {
      data: { id: "reporter-1", full_name: "N", role: "reporter", preferred_language: "fr" },
    });

    const result = await getReporterProfile();

    expect(result).toMatchObject({
      ok: true,
      profile: { preferredLanguage: "en", allowCaseContact: true, phone: "" },
    });
  });

  it("blocks staff accounts from the reporter profile", async () => {
    mockSignedInUser(user);
    queueTable("profiles", { data: { id: "reporter-1", full_name: "Officer", role: "case_officer" } });

    await expect(getReporterProfile()).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "This area is only available to reporter accounts.",
    });
  });

  it("retries with the basic columns when the extended select fails", async () => {
    mockSignedInUser(user);
    queueTable(
      "profiles",
      { error: { message: "column profiles.phone does not exist" } },
      { data: { id: "reporter-1", full_name: "Nimali Perera", role: "reporter" } },
    );

    const result = await getReporterProfile();

    expect(result).toEqual({
      ok: true,
      profile: {
        id: "reporter-1",
        fullName: "Nimali Perera",
        email: "nimali@example.com",
        phone: "+94 71 000 0000",
        preferredLanguage: "ta",
        allowCaseContact: false,
        role: "reporter",
      },
    });
    expect(callsOf(queriesFor("profiles")[1], "select")).toEqual([["id, full_name, role"]]);
  });

  it("blocks staff accounts in the fallback path too", async () => {
    mockSignedInUser(user);
    queueTable(
      "profiles",
      { error: { message: "fail" } },
      { data: { id: "reporter-1", full_name: "Admin", role: "system_admin" } },
    );

    await expect(getReporterProfile()).resolves.toMatchObject({
      ok: false,
      reason: "forbidden",
    });
  });

  it("reports a generic error when the profile cannot be loaded at all", async () => {
    mockSignedInUser(user);
    queueTable("profiles", { error: { message: "fail" } }, { error: { message: "fail" } });

    await expect(getReporterProfile()).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "JusticeNow could not load your profile.",
    });
  });
});
