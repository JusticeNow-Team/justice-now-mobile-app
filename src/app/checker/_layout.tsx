import { Stack } from "expo-router";
import React from "react";
import { RoleGuard } from "../../auth";

export default function CheckerLayout() {
  return (
    <RoleGuard allowedRoles={["evidence_validator"]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#F8FAFC",
          },
        }}
      />
    </RoleGuard>
  );
}
