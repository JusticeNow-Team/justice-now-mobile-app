import { supabase } from "../../lib/supabase";
import { ReporterLanguageCode } from "../registration/languages";
import { ReporterProfile } from "./types";

export type GetReporterProfileResult =
  | { ok: true; profile: ReporterProfile }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "generic"; message: string };

function asLanguage(value: unknown): ReporterLanguageCode {
  if (value === "si" || value === "ta" || value === "en") {
    return value;
  }

  return "en";
}

export async function getReporterProfile(): Promise<GetReporterProfileResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to view your profile.",
    };
  }

  const user = sessionData.user;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, phone, preferred_language, allow_case_contact")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    const fallback = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (fallback.error || !fallback.data) {
      return {
        ok: false,
        reason: "generic",
        message: "JusticeNow could not load your profile.",
      };
    }

    if (fallback.data.role !== "reporter") {
      return {
        ok: false,
        reason: "forbidden",
        message: "This area is only available to reporter accounts.",
      };
    }

    const metadata = user.user_metadata ?? {};

    return {
      ok: true,
      profile: {
        id: user.id,
        fullName: fallback.data.full_name ?? "",
        email: user.email ?? "",
        phone: typeof metadata.phone === "string" ? metadata.phone : "",
        preferredLanguage: asLanguage(metadata.preferred_language),
        allowCaseContact:
          typeof metadata.allow_case_contact === "boolean"
            ? metadata.allow_case_contact
            : true,
        role: fallback.data.role,
      },
    };
  }

  if (profile.role !== "reporter") {
    return {
      ok: false,
      reason: "forbidden",
      message: "This area is only available to reporter accounts.",
    };
  }

  const metadata = user.user_metadata ?? {};

  return {
    ok: true,
    profile: {
      id: user.id,
      fullName: profile.full_name ?? "",
      email: user.email ?? "",
      phone:
        (typeof profile.phone === "string" && profile.phone) ||
        (typeof metadata.phone === "string" ? metadata.phone : ""),
      preferredLanguage: asLanguage(
        profile.preferred_language ?? metadata.preferred_language
      ),
      allowCaseContact:
        typeof profile.allow_case_contact === "boolean"
          ? profile.allow_case_contact
          : typeof metadata.allow_case_contact === "boolean"
            ? metadata.allow_case_contact
            : true,
      role: profile.role,
    },
  };
}
