import { Stack } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { RoleGuard } from "../../auth";
import AdminBottomNavigation from "../../components/admin/AdminBottomNavigation";
import { colors } from "../../theme";

export default function AdminLayout() {
  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        />

        <AdminBottomNavigation />
      </View>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});