import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../auth";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "#F1F5FA",
            },
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
