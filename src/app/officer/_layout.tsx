import { Stack } from "expo-router";
import React from "react";
import { RoleGuard } from "../../auth";

export default function OfficerLayout() {
  return (
    <RoleGuard allowedRoles={["case_officer"]}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </RoleGuard>
  );
}
