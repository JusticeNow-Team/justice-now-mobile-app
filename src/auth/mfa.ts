import { supabase } from "../lib/supabase";

export const STAFF_MFA_TEMPORARILY_DISABLED = true;

export async function hasCompletedStaffMfa() {
  if (STAFF_MFA_TEMPORARILY_DISABLED) {
    return {
      verified: true,
      error: null,
    };
  }

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error) {
    return {
      verified: false,
      error,
    };
  }

  return {
    verified: data.currentLevel === "aal2",
    error: null,
  };
}
