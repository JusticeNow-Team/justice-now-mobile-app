import { registerReporter } from "../../src/reporter/registration/registerReporter";
import { supabase } from "../mocks/supabaseClient";

const input = {
  fullName: "  Nimali Perera  ",
  email: "  Nimali@Example.COM ",
  mobile: " +94 77 123 4567 ",
  password: "SafePass2026",
  language: "si" as const,
  allowContact: false,
};

const DUPLICATE_MESSAGE =
  "An account with this email already exists. Sign in, or use a different email.";

describe("JN-30 Reporter registration - registerReporter()", () => {
  it("signs up with a normalised email and reporter metadata", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] } },
      error: null,
    });

    const result = await registerReporter(input);

    expect(result).toEqual({ ok: true, email: "nimali@example.com" });
    expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "nimali@example.com",
      password: "SafePass2026",
      options: {
        data: {
          full_name: "Nimali Perera",
          phone: "+94 77 123 4567",
          preferred_language: "si",
          allow_case_contact: false,
          role: "reporter",
        },
      },
    });
  });

  it("always registers the account with the reporter role", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] } },
      error: null,
    });

    await registerReporter(input);

    const [{ options }] = supabase.auth.signUp.mock.calls[0];
    expect(options.data.role).toBe("reporter");
  });

  it("reports a duplicate account when Supabase returns a user with no identities", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [] } },
      error: null,
    });

    await expect(registerReporter(input)).resolves.toEqual({
      ok: false,
      message: DUPLICATE_MESSAGE,
    });
  });

  it.each([
    [{ code: "user_already_exists", message: "Whatever" }],
    [{ message: "User already registered" }],
    [{ message: "A user with this email address already exists" }],
  ])("maps the duplicate-account error %p to a friendly message", async (error) => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: null }, error });

    await expect(registerReporter(input)).resolves.toEqual({
      ok: false,
      message: DUPLICATE_MESSAGE,
    });
  });

  it("passes password policy errors straight through", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Password should contain at least one symbol" },
    });

    await expect(registerReporter(input)).resolves.toEqual({
      ok: false,
      message: "Password should contain at least one symbol",
    });
  });

  it("returns other Supabase error messages", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Signups not allowed for this instance" },
    });

    await expect(registerReporter(input)).resolves.toEqual({
      ok: false,
      message: "Signups not allowed for this instance",
    });
  });

  it("fails safely when Supabase returns no user and no error", async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: null });

    await expect(registerReporter(input)).resolves.toEqual({
      ok: false,
      message: "JusticeNow could not create your account. Please try again.",
    });
  });

  it("falls back to offline demo mode when the backend cannot be reached", async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "TypeError: Failed to fetch" },
    });

    await expect(registerReporter(input)).resolves.toEqual({
      ok: true,
      email: "nimali@example.com",
    });
  });

  it("falls back to demo mode when signUp throws", async () => {
    supabase.auth.signUp.mockRejectedValue(new Error("Network down"));

    await expect(registerReporter(input)).resolves.toEqual({
      ok: true,
      email: "nimali@example.com",
    });
  });
});
