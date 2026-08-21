import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAllRoles, RoleGuard, SystemRole } from "../../auth";
import { colors } from "../../theme";

export default function AdminRolesManagementScreen() {
  const router = useRouter();
  const roles = getAllRoles();
  const [selectedRole, setSelectedRole] = useState<SystemRole>("system_admin");

  const currentRole = roles.find((r) => r.id === selectedRole) || roles[0];

  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>System Roles & Permissions</Text>
            <Text style={styles.headerSubtitle}>RBAC Configuration</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Role selector tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {roles.map((r) => {
              const active = r.id === selectedRole;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedRole(r.id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={styles.tabIcon}>{r.icon}</Text>
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {r.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active Role Card */}
          <View style={styles.card}>
            <View style={styles.roleHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: currentRole.badgeColor.background },
                ]}
              >
                <Text style={styles.roleIconLarge}>{currentRole.icon}</Text>
              </View>
              <View style={styles.roleTitleWrap}>
                <Text style={styles.roleTitle}>{currentRole.label}</Text>
                <Text style={styles.roleSub}>
                  Role Identifier:{" "}
                  <Text style={styles.codeText}>{currentRole.id}</Text>
                </Text>
              </View>
            </View>

            <Text style={styles.roleDesc}>{currentRole.description}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>DEFAULT ROUTE</Text>
                <Text style={styles.metaValue}>{currentRole.defaultRoute}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>ACCOUNT TYPE</Text>
                <Text style={styles.metaValue}>
                  {currentRole.isStaff ? "JusticeNow Staff" : "Public Reporter"}
                </Text>
              </View>
            </View>
          </View>

          {/* Permissions Matrix */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Assigned Permissions ({currentRole.permissions.length})
            </Text>
            <View style={styles.permissionList}>
              {currentRole.permissions.map((perm) => (
                <View key={perm} style={styles.permissionRow}>
                  <Text style={styles.check}>✓</Text>
                  <View style={styles.permTextWrap}>
                    <Text style={styles.permCode}>{perm}</Text>
                    <Text style={styles.permDescription}>
                      {getPermissionDescription(perm)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </RoleGuard>
  );
}

function getPermissionDescription(permission: string): string {
  switch (permission) {
    case "cases:create":
      return "Ability to lodge and submit a new human rights violation report.";
    case "cases:read:own":
      return "View cases submitted by the authenticated user.";
    case "cases:read:assigned":
      return "View investigation cases assigned to the authenticated staff member.";
    case "cases:read:all":
      return "View all registered cases in the organization.";
    case "cases:update:status":
      return "Update triage, investigation, and resolution stages.";
    case "cases:request_info":
      return "Send secure clarification requests to reporters.";
    case "cases:delete":
      return "Archive or purge fraudulent or obsolete case records.";
    case "evidence:upload:own":
      return "Attach photos, documents, and media to personal case reports.";
    case "evidence:read:own":
      return "Access evidence attached to submitted reports.";
    case "evidence:read:assigned":
      return "Examine evidence files for assigned case investigations.";
    case "evidence:read:all":
      return "Access all forensic evidence files across cases.";
    case "evidence:validate":
      return "Conduct integrity checks and log forensic validation results.";
    case "evidence:assign":
      return "Assign evidence files to specific Evidence Checkers.";
    case "admin:users:read":
      return "View directory of staff and registered user accounts.";
    case "admin:users:manage":
      return "Create, activate, suspend, or update user profiles.";
    case "admin:roles:manage":
      return "Assign and reallocate system roles and capability policies.";
    case "admin:audit_logs:read":
      return "Inspect tamper-evident system and access audit trails.";
    case "admin:system:configure":
      return "Manage encryption keys, policies, and system parameters.";
    case "profile:read:own":
      return "Read personal account settings and profile information.";
    case "profile:update:own":
      return "Update display name, contact preferences, and profile details.";
    case "profile:security:manage":
      return "Change password, setup TOTP 2FA, and manage security.";
    default:
      return "Granted system capability.";
  }
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  backText: {
    fontSize: 30,
    color: colors.navy[800],
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconLarge: {
    fontSize: 24,
  },
  roleTitleWrap: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  roleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  codeText: {
    fontFamily: "monospace",
    color: colors.royal[700],
    fontWeight: "600",
  },
  roleDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSoft,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
    marginBottom: 12,
  },
  permissionList: {
    gap: 10,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy[50],
  },
  check: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.success,
    marginTop: 1,
  },
  permTextWrap: {
    flex: 1,
  },
  permCode: {
    fontFamily: "monospace",
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[900],
  },
  permDescription: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
