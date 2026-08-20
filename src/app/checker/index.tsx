import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleGuard, useAuth } from "../../auth";
import { colors } from "../../theme";

export default function EvidenceCheckerScreen() {
  const router = useRouter();
  const { user, role, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <RoleGuard allowedRoles={["evidence_checker"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Evidence Checker</Text>
            <Text style={styles.headerSubtitle}>Forensic Validation Portal</Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={styles.signOutButton}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>🔍 Evidence Checker</Text>
            </View>
            <Text style={styles.userName}>
              {user?.full_name || "Evidence Validator"}
            </Text>
            <Text style={styles.userRole}>
              Active Role: <Text style={styles.bold}>{role}</Text>
            </Text>
          </View>

          {/* Quick Metrics */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Pending Review</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>48</Text>
              <Text style={styles.statLabel}>Validated</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Flagged</Text>
            </View>
          </View>

          {/* Permissions Overview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Granted System Capabilities</Text>
            <View style={styles.permissionItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.permissionText}>
                Validate & verify evidence authenticity (
                <Text style={styles.codeText}>evidence:validate</Text>)
              </Text>
            </View>
            <View style={styles.permissionItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.permissionText}>
                Read all evidence files & metadata (
                <Text style={styles.codeText}>evidence:read:all</Text>)
              </Text>
            </View>
            <View style={styles.permissionItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.permissionText}>
                View assigned case details (
                <Text style={styles.codeText}>cases:read:assigned</Text>)
              </Text>
            </View>
          </View>

          {/* Action notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>🛡️ Chain of Custody Protected</Text>
            <Text style={styles.noticeText}>
              All forensic checks, hash validations, and verification decisions
              are immutably logged with timestamp and officer ID.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  signOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },
  content: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EAF7F8",
    borderWidth: 1,
    borderColor: "#A2E0E4",
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#155C63",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },
  userRole: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: "600",
    color: colors.navy[800],
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy[900],
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.success,
  },
  permissionText: {
    fontSize: 13,
    color: colors.navy[800],
    flex: 1,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: colors.royal[700],
  },
  noticeCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EAF7F8",
    borderWidth: 1,
    borderColor: "#CFEFF1",
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#17737B",
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
