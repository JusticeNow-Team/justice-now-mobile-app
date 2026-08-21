import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";
import { useAuth } from "../useAuth";
import { Permission } from "../types";

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
}: PermissionGuardProps) {
  const { can, permissions: userPermissions, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  let isAllowed = true;

  if (permission) {
    isAllowed = can(permission);
  } else if (permissions && permissions.length > 0) {
    if (requireAll) {
      isAllowed = permissions.every((p) => userPermissions.includes(p));
    } else {
      isAllowed = permissions.some((p) => userPermissions.includes(p));
    }
  }

  if (!isAllowed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Action Not Permitted</Text>
          <Text style={styles.message}>
            Your account does not have permission to execute this operation.
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  icon: {
    fontSize: 28,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 4,
    textAlign: "center",
  },
  message: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
