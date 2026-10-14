import { changeReporterPassword } from "../../src/reporter/password/changeReporterPassword";
import {
  mockProfileRole,
  mockSignedInUser,
  supabase,
} from "../mocks/supabaseClient";

const reporter = { id: "reporter-1", email: "nimali@example.com" };

describe("JN-59 Change password - changeReporterPassword()", () => {
  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(changeReporterPassword("OldSecure2025", "NewSecure2026")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to change your password.",
    });
  });

  it("requires the signed-in user to have an email", async () => {
    mockSignedInUser({ id: "reporter-1" });

    await expect(changeReporterPassword("OldSecure2025", "NewSecure2026")).resolves.toMatchObject({
      ok: false,
      reason: "unauthenticated",
    });
  });

  it("blocks non-reporter accounts", async () => {
    mockSignedInUser(reporter);
    mockProfileRole("case_officer");

    await expect(changeReporterPassword("OldSecure2025", "NewSecure2026")).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "This area is only available to reporter accounts.",
    });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("verifies the current password, updates it and signs out other sessions", async () => {
    mockSignedInUser(reporter);
    mockProfileRole("reporter");
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    await expect(changeReporterPassword("OldSecure2025", "NewSecure2026")).resolves.toEqual({
      ok: true,
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "nimali@example.com",
      password: "OldSecure2025",
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "NewSecure2026" });
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("rejects an incorrect current password without updating", async () => {
    mockSignedInUser(reporter);
    mockProfileRole("reporter");
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    await expect(changeReporterPassword("WrongPass2025", "NewSecure2026")).resolves.toEqual({
      ok: false,
      reason: "invalid_current",
      message: "Your current password is incorrect.",
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["New password should be different from the old password.", "Choose a password that is different from your current one."],
    ["Password is the same as before", "Choose a password that is different from your current one."],
    ["Password is too weak", "Password is too weak"],
    ["Rate limit exceeded", "Rate limit exceeded"],
  ])("maps the update error %p", async (supabaseMessage, expected) => {
    mockSignedInUser(reporter);
    mockProfileRole("reporter");
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: { message: supabaseMessage } });

    await expect(changeReporterPassword("OldSecure2025", "NewSecure2026")).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: expected,
    });
  });

  it("still succeeds when signing out other sessions fails", async () => {
    mockSignedInUser(reporter);
    mockProfileRole("reporter");
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    supabase.auth.signOut.mockRejectedValue(new Error("network"));

    await expect(changeReporterPassword("OldSecure2025", "NewSecure2026")).resolves.toEqual({
      ok: true,
    });
  });
});
