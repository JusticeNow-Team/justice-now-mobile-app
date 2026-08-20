import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://placeholder-project.supabase.co";

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

if (
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
) {
  console.warn(
    "⚠️ Missing Supabase environment variables. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your .env file."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...(Platform.OS !== "web"
        ? { storage: AsyncStorage }
        : {}),

      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}