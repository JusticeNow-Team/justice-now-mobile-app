import { supabase } from "../../lib/supabase";

export async function logoutReporter() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
