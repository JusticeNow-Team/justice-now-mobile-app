import { AuthError } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

export type ChangeReporterPasswordResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "invalid_current" | "generic";
      message: string;
    };

function mapUpdateError(error: AuthError) {
  const message = error.message.toLowerCase();

  if (message.includes("same") || message.includes("should be different")) {
    return "Choose a password that is different from your current one.";
  }

  if (message.includes("password")) {
    return error.message;
  }

  return error.message || "We could not change your password. Please try again.";
}

export async function changeReporterPassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangeReporterPasswordResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user?.email) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to change your password.",
    };
  }

  const user = sessionData.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "reporter") {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "This area is only available to reporter accounts.",
    };
  }

  const { error: currentError } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password: currentPassword,
  });

  if (currentError) {
    return {
      ok: false,
      reason: "invalid_current",
      message: "Your current password is incorrect.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return {
      ok: false,
      reason: "generic",
      message: mapUpdateError(updateError),
    };
  }

  await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);

  return { ok: true };
}
