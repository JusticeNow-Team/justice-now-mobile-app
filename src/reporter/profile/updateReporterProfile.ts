import { supabase } from "../../lib/supabase";
import { ReporterLanguageCode } from "../registration/languages";

export interface UpdateReporterProfileInput {
  fullName: string;
  phone: string;
  preferredLanguage: ReporterLanguageCode;
  allowCaseContact: boolean;
}

export type UpdateReporterProfileResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateReporterProfile(
  input: UpdateReporterProfileInput
): Promise<UpdateReporterProfileResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      message: "Please sign in to update your profile.",
    };
  }

  const userId = sessionData.user.id;

  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (currentError || !current) {
    return {
      ok: false,
      message: "JusticeNow could not verify your profile.",
    };
  }

  if (current.id !== userId || current.role !== "reporter") {
    return {
      ok: false,
      message: "You can only update your own reporter profile.",
    };
  }

  const updates = {
    full_name: input.fullName.trim(),
    phone: input.phone.trim(),
    preferred_language: input.preferredLanguage,
    allow_case_contact: input.allowCaseContact,
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .eq("role", "reporter");

  if (updateError) {
    const fallback = await supabase
      .from("profiles")
      .update({ full_name: updates.full_name })
      .eq("id", userId)
      .eq("role", "reporter");

    if (fallback.error) {
      return {
        ok: false,
        message:
          updateError.message ||
          "We could not save your profile. Please try again.",
      };
    }
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      full_name: updates.full_name,
      phone: updates.phone,
      preferred_language: updates.preferred_language,
      allow_case_contact: updates.allow_case_contact,
    },
  });

  if (metadataError) {
    return {
      ok: false,
      message:
        "Your profile was saved, but account details could not be fully updated. Please try again.",
    };
  }

  return { ok: true };
}
