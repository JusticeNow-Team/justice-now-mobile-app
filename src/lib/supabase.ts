import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase configuration. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the .env file."
  );
}

// Safe WebSocket transport fallback for Node/SSR bundling environments
const RealtimeTransport =
  typeof WebSocket !== "undefined"
    ? WebSocket
    : typeof globalThis !== "undefined" && (globalThis as any).WebSocket
      ? (globalThis as any).WebSocket
      : class DummyWebSocket {};

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...(Platform.OS !== "web"
        ? {
            storage: AsyncStorage,
          }
        : {}),

      autoRefreshToken: typeof window !== "undefined",
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      transport: RealtimeTransport,
    },
  }
);

// Keep authentication tokens refreshed while the mobile app is active.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}