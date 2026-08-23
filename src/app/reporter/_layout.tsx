import { Stack } from "expo-router";
import React from "react";
import { RoleGuard } from "../../auth";

export default function ReporterLayout() {
  return (
    <RoleGuard allowedRoles={["reporter"]}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </RoleGuard>
  );
}