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
import { getAllRoles, RoleGuard, useAuth } from "../../auth";
import { colors } from "../../theme";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, role, signOut } = useAuth();
  const roles = getAllRoles();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>System Administrator</Text>
            <Text style={styles.headerSubtitle}>JusticeNow Control Center</Text>
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
          {/* Admin Profile */}
          <View style={styles.profileCard}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>⚙️ System Admin</Text>
            </View>
            <Text style={styles.userName}>
              {user?.full_name || "System Administrator"}
            </Text>
            <Text style={styles.userRole}>
              Active Role: <Text style={styles.bold}>{role}</Text>
            </Text>
          </View>

          {/* Management Shortcuts */}
          <View style={styles.actionGrid}>
            <Pressable
              style={styles.actionCard}
              onPress={() => router.push("/admin/roles")}
              accessibilityRole="button"
              accessibilityLabel="Manage Roles & Permissions"
            >
              <Text style={styles.actionIcon}>🔐</Text>
              <Text style={styles.actionTitle}>Roles & Permissions</Text>
              <Text style={styles.actionDesc}>
                Configure the 4 system roles and security capabilities.
              </Text>
            </Pressable>
          </View>

          {/* Configured Roles Overview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Configured System Roles</Text>
            {roles.map((r) => (
              <View key={r.id} style={styles.roleItem}>
                <View style={styles.roleItemHeader}>
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <View style={styles.roleItemInfo}>
                    <Text style={styles.roleName}>{r.label}</Text>
                    <Text style={styles.roleKey}>
                      Key: <Text style={styles.codeText}>{r.id}</Text>
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.staffBadge,
                      r.isStaff ? styles.staffTrue : styles.staffFalse,
                    ]}
                  >
                    <Text
                      style={[
                        styles.staffBadgeText,
                        r.isStaff
                          ? styles.staffTrueText
                          : styles.staffFalseText,
                      ]}
                    >
                      {r.isStaff ? "Staff" : "Public"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.roleDesc}>{r.description}</Text>
                <Text style={styles.permCount}>
                  🛡️ {r.permissions.length} granular permissions configured
                </Text>
              </View>
            ))}
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
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FBF7EC",
    borderWidth: 1,
    borderColor: "#E9D69D",
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#AF8722",
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
  actionGrid: {
    gap: 12,
  },
  actionCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.royal[50],
    borderWidth: 1,
    borderColor: colors.royal[100],
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.royal[800],
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  roleItem: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
  },
  roleItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  roleIcon: {
    fontSize: 20,
  },
  roleItemInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[900],
  },
  roleKey: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  codeText: {
    fontFamily: "monospace",
    color: colors.royal[700],
  },
  staffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffTrue: {
    backgroundColor: colors.royal[100],
  },
  staffFalse: {
    backgroundColor: colors.navy[100],
  },
  staffBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  staffTrueText: {
    color: colors.royal[800],
  },
  staffFalseText: {
    color: colors.navy[700],
  },
  roleDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  permCount: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
});
