import { AuthError } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

export type LoginReporterResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_credentials" | "staff" | "profile" | "generic";
      message: string;
    };

const INVALID_CREDENTIALS_MESSAGE =
  "Invalid email or password. Check your details and try again.";

function mapLoginError(error: AuthError): LoginReporterResult {
  const message = error.message.toLowerCase();
  const code = error.code ?? "";

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login") ||
    message.includes("invalid email or password") ||
    message.includes("invalid_grant")
  ) {
    return {
      ok: false,
      reason: "invalid_credentials",
      message: INVALID_CREDENTIALS_MESSAGE,
    };
  }

  if (
    message.includes("email not confirmed") ||
    code === "email_not_confirmed"
  ) {
    return {
      ok: false,
      reason: "generic",
      message:
        "Please verify your email with the code we sent before signing in.",
    };
  }

  return {
    ok: false,
    reason: "generic",
    message: error.message || "Unable to sign in. Please try again.",
  };
}

export async function loginReporter(
  email: string,
  password: string
): Promise<LoginReporterResult> {
  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    return mapLoginError(error);
  }

  if (!data.user || !data.session) {
    return {
      ok: false,
      reason: "generic",
      message: "JusticeNow could not sign you in.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();

    return {
      ok: false,
      reason: "profile",
      message:
        "Your account was authenticated, but JusticeNow could not load your profile.",
    };
  }

  if (profile.role === "reporter") {
    return { ok: true };
  }

  await supabase.auth.signOut();

  return {
    ok: false,
    reason: "staff",
    message:
      "Please use Staff access to sign in with your JusticeNow staff account.",
  };
}
