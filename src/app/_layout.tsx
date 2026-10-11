import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { AuthProvider } from "../auth";
import { AppFeedbackProvider } from "../components/common/AppFeedback";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AuthProvider>
        <AppFeedbackProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: "#F1F5FA",
              },
            }}
          />
        </AppFeedbackProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
