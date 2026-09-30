import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../auth";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1, ...(Platform.OS === "web" ? { height: "100vh", minHeight: "100vh" } : {}) }}>
    <SafeAreaProvider>
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
