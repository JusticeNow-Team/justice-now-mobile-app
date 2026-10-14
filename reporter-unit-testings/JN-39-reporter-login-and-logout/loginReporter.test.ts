import { loginReporter } from "../../src/reporter/login/loginReporter";
import { logoutReporter } from "../../src/reporter/login/logoutReporter";
import {
  callsOf,
  queriesFor,
  queueTable,
  supabase,
} from "../mocks/supabaseClient";

const signedIn = {
  data: {
    user: { id: "reporter-1", email: "reporter@example.com" },
    session: { access_token: "token" },
  },
  error: null,
};

describe("JN-39 Reporter login - loginReporter()", () => {
  it("signs in with a trimmed, lower-cased email", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue(signedIn);
    queueTable("profiles", {
      data: { role: "reporter", is_active: true, status: "active" },
    });

    await loginReporter("  Reporter@Example.COM ", "Secret123");

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "reporter@example.com",
      password: "Secret123",
    });
  });

  it("lets an active reporter in and checks their own profile row", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue(signedIn);
    queueTable("profiles", {
      data: { role: "reporter", is_active: true, status: "active" },
    });

    await expect(loginReporter("reporter@example.com", "Secret123")).resolves.toEqual({
      ok: true,
    });

    const [profileQuery] = queriesFor("profiles");
    expect(callsOf(profileQuery, "select")).toEqual([["role, is_active, status"]]);
    expect(callsOf(profileQuery, "eq")).toEqual([["id", "reporter-1"]]);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it.each(["case_officer", "evidence_checker", "system_admin"])(
    "signs a %s back out and directs them to staff access",
    async (role) => {
      supabase.auth.signInWithPassword.mockResolvedValue(signedIn);
      queueTable("profiles", { data: { role, is_active: true, status: "active" } });

      await expect(loginReporter("staff@example.com", "Secret123")).resolves.toEqual({
        ok: false,
        reason: "staff",
        message:
          "Please use Staff access to sign in with your JusticeNow staff account.",
      });
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { is_active: false, status: "active" },
    { is_active: true, status: "inactive" },
    { is_active: true, status: "suspended" },
  ])("blocks and signs out an inactive account %p", async (flags) => {
    supabase.auth.signInWithPassword.mockResolvedValue(signedIn);
    queueTable("profiles", { data: { role: "reporter", ...flags } });

    const result = await loginReporter("reporter@example.com", "Secret123");

    expect(result).toEqual({
      ok: false,
      reason: "inactive",
      message:
        "Your account or assigned role is currently inactive. Please contact your system administrator.",
    });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: "invalid_credentials", message: "x" },
    { message: "Invalid login credentials" },
    { message: "Invalid email or password" },
    { message: "invalid_grant" },
  ])("maps the credential error %p to a generic message", async (error) => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error });

    await expect(loginReporter("reporter@example.com", "wrong")).resolves.toEqual({
      ok: false,
      reason: "invalid_credentials",
      message: "Invalid email or password. Check your details and try again.",
    });
  });

  it("asks the reporter to verify an unconfirmed email", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    await expect(loginReporter("reporter@example.com", "Secret123")).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "Please verify your email with the code we sent before signing in.",
    });
  });

  it("returns unknown Supabase errors as generic failures", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Too many requests" },
    });

    await expect(loginReporter("reporter@example.com", "Secret123")).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "Too many requests",
    });
  });

  it("fails when Supabase returns no session", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "reporter-1" }, session: null },
      error: null,
    });

    await expect(loginReporter("reporter@example.com", "Secret123")).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "JusticeNow could not sign you in.",
    });
  });

  it("continues as a reporter when the profile row cannot be loaded (demo mode)", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue(signedIn);
    queueTable("profiles", { data: null, error: { message: "not found" } });

    await expect(loginReporter("reporter@example.com", "Secret123")).resolves.toEqual({
      ok: true,
    });
  });

  it("simulates sign in when the backend is unreachable", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "fetch failed" },
    });

    await expect(loginReporter("reporter@example.com", "Secret123")).resolves.toEqual({
      ok: true,
    });
  });
});

describe("JN-39 Reporter logout - logoutReporter()", () => {
  it("signs the reporter out of Supabase", async () => {
    await expect(logoutReporter()).resolves.toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("throws the Supabase error if sign out fails", async () => {
    const error = new Error("Sign out failed");
    supabase.auth.signOut.mockResolvedValue({ error });

    await expect(logoutReporter()).rejects.toBe(error);
  });
});
