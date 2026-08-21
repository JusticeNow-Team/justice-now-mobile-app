import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";
import { isAccountActive } from "../navigation";
import { SystemRole } from "../types";
import { useAuth } from "../useAuth";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: SystemRole[];
  fallback?: React.ReactNode;
  redirectToUnauthorized?: boolean;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectToUnauthorized = false,
}: RoleGuardProps) {
  const router = useRouter();
  const { role, user, isLoading, loginAsRole, signOut } = useAuth();

  if (isLoading) {
    return null;
  }

  // 1. Check account active status (JN-182)
  if (user && !isAccountActive(user)) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Account Inactive</Text>
          <Text style={styles.message}>
            Your account or assigned role is currently inactive. Please contact your system administrator at{" "}
            <Text style={styles.bold}>admin@justicenow.org</Text>.
          </Text>

          <Pressable
            style={styles.authButton}
            onPress={async () => {
              await signOut();
              router.replace("/login");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.authButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. Check role authorization (JN-179)
  const isAllowed = role && allowedRoles.includes(role);

  if (!isAllowed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (redirectToUnauthorized) {
      router.replace("/unauthorized");
      return null;
    }

    const targetRole = allowedRoles[0] || "system_admin";
    const targetLabel =
      targetRole === "system_admin"
        ? "System Admin"
        : targetRole === "case_officer"
        ? "Case Officer"
        : targetRole === "evidence_checker"
        ? "Evidence Checker"
        : "Reporter";

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.message}>
            You must be authenticated as a{" "}
            <Text style={styles.bold}>{targetLabel}</Text> to view this section.
          </Text>

          <Pressable
            style={styles.authButton}
            onPress={() => loginAsRole(targetRole)}
            accessibilityRole="button"
          >
            <Text style={styles.authButtonText}>
              ⚙️ Authenticate as {targetLabel}
            </Text>
          </Pressable>

          <Pressable
            style={styles.loginLink}
            onPress={() => router.push("/secure-role")}
            accessibilityRole="button"
          >
            <Text style={styles.loginLinkText}>
              Go to Staff & Admin Login
            </Text>
          </Pressable>

          <Pressable
            style={styles.unauthorizedLink}
            onPress={() => router.push("/unauthorized")}
            accessibilityRole="button"
          >
            <Text style={styles.unauthorizedLinkText}>
              View Security Notice Details
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  icon: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  bold: {
    fontWeight: "700",
    color: colors.navy[900],
  },
  authButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor: colors.royal[700],
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  authButtonText: {
    color: colors.textInverse,
    fontSize: 13.5,
    fontWeight: "700",
  },
  loginLink: {
    paddingVertical: 6,
  },
  loginLinkText: {
    color: colors.royal[700],
    fontSize: 12.5,
    fontWeight: "600",
  },
  unauthorizedLink: {
    paddingVertical: 4,
    marginTop: 2,
  },
  unauthorizedLinkText: {
    color: colors.textSoft,
    fontSize: 11.5,
  },
});
