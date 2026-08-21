import { Stack } from "expo-router";
import { AuthProvider } from "../auth";

export default function RootLayout() {
  return (
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
  );
}