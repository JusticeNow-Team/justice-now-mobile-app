import { Stack } from "expo-router";
import React from "react";
import { RoleGuard } from "../../auth";

export default function AdminLayout() {
  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#F1F5FA",
          },
        }}
      />
    </RoleGuard>
  );
}
