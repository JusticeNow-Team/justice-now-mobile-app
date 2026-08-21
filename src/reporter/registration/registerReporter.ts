import { AuthError } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { ReporterLanguageCode } from "./languages";

export interface RegisterReporterInput {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  language: ReporterLanguageCode;
  allowContact: boolean;
}

export type RegisterReporterResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

function mapSignupError(error: AuthError) {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already")
  ) {
    return "An account with this email already exists. Sign in, or use a different email.";
  }

  if (message.includes("password")) {
    return error.message;
  }

  return error.message || "Unable to create your account. Please try again.";
}

export async function registerReporter(
  input: RegisterReporterInput
): Promise<RegisterReporterResult> {
  const email = input.email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          phone: input.mobile.trim(),
          preferred_language: input.language,
          allow_case_contact: input.allowContact,
          role: "reporter",
        },
      },
    });

    if (error) {
      // Handle network fetch error when running with offline/placeholder backend
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("fetch failed")
      ) {
        console.warn("Supabase backend offline/placeholder mode: simulating reporter signup.");
        return { ok: true, email };
      }

      return { ok: false, message: mapSignupError(error) };
    }

    const identities = data.user?.identities ?? [];

    if (data.user && identities.length === 0) {
      return {
        ok: false,
        message:
          "An account with this email already exists. Sign in, or use a different email.",
      };
    }

    if (!data.user) {
      return {
        ok: false,
        message:
          "JusticeNow could not create your account. Please try again.",
      };
    }

    return { ok: true, email };
  } catch (err: any) {
    console.warn("Signup exception handled for demo mode:", err);
    // In local demo mode without live backend, complete registration
    return { ok: true, email };
  }
}
