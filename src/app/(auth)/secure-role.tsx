import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth";
import { SystemRole } from "../../auth/types";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

type AuthMode = "signin" | "signup";

export default function SecureRoleScreen() {
  const router = useRouter();
  const { loginAsRole } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedStaffRole, setSelectedStaffRole] =
    useState<SystemRole>("system_admin");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // -------------------------------------------------------
  // Route verified staff by their database role
  // -------------------------------------------------------

  const routeStaff = async (role: string) => {
    const normalized =
      role === "evidence_validator" ? "evidence_checker" : role;

    if (normalized === "case_officer") {
      router.replace("/officer");
      return;
    }

    if (normalized === "evidence_checker") {
      router.replace("/checker");
      return;
    }

    if (normalized === "system_admin") {
      router.replace("/admin");
      return;
    }

    await supabase.auth.signOut();

    Alert.alert(
      "Access denied",
      "This account does not have an authorized JusticeNow staff role."
    );
  };

  // -------------------------------------------------------
  // Quick Direct Role Login (Development & Admin Preview)
  // -------------------------------------------------------

  const handleQuickDemoLogin = (role: SystemRole) => {
    loginAsRole(role);
    if (role === "system_admin") {
      router.replace("/admin");
    } else if (role === "case_officer") {
      router.replace("/officer");
    } else if (role === "evidence_checker") {
      router.replace("/checker");
    } else {
      router.replace("/reporter");
    }
  };

  // -------------------------------------------------------
  // Staff Registration (Create Admin / Staff Account)
  // -------------------------------------------------------

  const handleStaffRegister = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!cleanEmail) {
      setErrorMessage("Please enter your staff email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            role: selectedStaffRole,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        Alert.alert("Account creation failed", error.message);
        return;
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: cleanName,
          role: selectedStaffRole,
          updated_at: new Date().toISOString(),
        });

        loginAsRole(selectedStaffRole, cleanName);

        Alert.alert(
          "Staff account ready",
          `Successfully registered as ${getRoleLabel(selectedStaffRole)}!`,
          [
            {
              text: "Enter Workspace",
              onPress: () => routeStaff(selectedStaffRole),
            },
          ]
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create staff account.";
      setErrorMessage(message);
      Alert.alert("Registration error", message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Staff Login
  // -------------------------------------------------------

  const handleStaffLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Please enter your staff email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your staff account password.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        Alert.alert("Staff sign in failed", error.message);
        return;
      }

      if (!data.user) {
        setErrorMessage("JusticeNow could not authenticate this account.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMessage("JusticeNow could not load your staff profile.");
        Alert.alert(
          "Staff profile error",
          "JusticeNow could not load your authorized staff profile."
        );
        return;
      }

      if (profile.role === "reporter") {
        await supabase.auth.signOut();
        Alert.alert(
          "Staff access only",
          "This is a Reporter account. Please use regular sign in instead."
        );
        return;
      }

      const allowedStaffRoles = [
        "case_officer",
        "evidence_checker",
        "evidence_validator",
        "system_admin",
      ];

      if (!allowedStaffRoles.includes(profile.role)) {
        await supabase.auth.signOut();
        Alert.alert(
          "Access denied",
          "This account does not have an authorized JusticeNow staff role."
        );
        return;
      }

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        await supabase.auth.signOut();
        Alert.alert("Security check failed", aalError.message);
        return;
      }

      if (aal.currentLevel === "aal2") {
        await routeStaff(profile.role);
        return;
      }

      router.push("/two-factor");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in to the staff workspace.";
      setErrorMessage(message);
      Alert.alert("Staff sign in error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Staff & Admin Portal</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🛡️</Text>
            </View>
            <Text style={styles.title}>JusticeNow Staff Access</Text>
            <Text style={styles.description}>
              Access the System Admin, Case Officer, or Evidence Checker
              workspaces.
            </Text>
          </View>

          {/* Quick Demo Preview / Fast Access Bar */}
          <View style={styles.quickAccessCard}>
            <Text style={styles.quickAccessTitle}>
              ⚡ Instant Role Access (Preview / Testing)
            </Text>
            <Text style={styles.quickAccessSubtitle}>
              Tap to enter and test any workspace immediately:
            </Text>
            <View style={styles.quickButtonGrid}>
              <Pressable
                style={[styles.quickButton, styles.adminQuickButton]}
                onPress={() => handleQuickDemoLogin("system_admin")}
                accessibilityRole="button"
              >
                <Text style={styles.quickButtonIcon}>⚙️</Text>
                <Text style={styles.quickButtonText}>System Admin</Text>
              </Pressable>

              <Pressable
                style={[styles.quickButton, styles.officerQuickButton]}
                onPress={() => handleQuickDemoLogin("case_officer")}
                accessibilityRole="button"
              >
                <Text style={styles.quickButtonIcon}>⚖️</Text>
                <Text style={styles.quickButtonText}>Case Officer</Text>
              </Pressable>

              <Pressable
                style={[styles.quickButton, styles.checkerQuickButton]}
                onPress={() => handleQuickDemoLogin("evidence_checker")}
                accessibilityRole="button"
              >
                <Text style={styles.quickButtonIcon}>🔍</Text>
                <Text style={styles.quickButtonText}>Evidence Checker</Text>
              </Pressable>
            </View>
          </View>

          {/* Form Card with Tabs */}
          <View style={styles.loginCard}>
            {/* Tab switch */}
            <View style={styles.tabsRow}>
              <Pressable
                onPress={() => {
                  setAuthMode("signin");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                style={[
                  styles.tabItem,
                  authMode === "signin" && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    authMode === "signin" && styles.tabItemTextActive,
                  ]}
                >
                  Staff Sign In
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setAuthMode("signup");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                style={[
                  styles.tabItem,
                  authMode === "signup" && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    authMode === "signup" && styles.tabItemTextActive,
                  ]}
                >
                  Create Admin/Staff
                </Text>
              </Pressable>
            </View>

            {authMode === "signup" ? (
              <>
                <Text style={styles.loginTitle}>Create Staff Account</Text>
                <Text style={styles.loginSubtitle}>
                  Register a new administrator, investigator, or evidence
                  checker.
                </Text>

                {/* Role Picker */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Select Staff Role</Text>
                  <View style={styles.rolePickerRow}>
                    <Pressable
                      style={[
                        styles.roleOption,
                        selectedStaffRole === "system_admin" &&
                          styles.roleOptionSelected,
                      ]}
                      onPress={() => setSelectedStaffRole("system_admin")}
                    >
                      <Text style={styles.roleOptionIcon}>⚙️</Text>
                      <Text
                        style={[
                          styles.roleOptionText,
                          selectedStaffRole === "system_admin" &&
                            styles.roleOptionTextSelected,
                        ]}
                      >
                        Admin
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.roleOption,
                        selectedStaffRole === "case_officer" &&
                          styles.roleOptionSelected,
                      ]}
                      onPress={() => setSelectedStaffRole("case_officer")}
                    >
                      <Text style={styles.roleOptionIcon}>⚖️</Text>
                      <Text
                        style={[
                          styles.roleOptionText,
                          selectedStaffRole === "case_officer" &&
                            styles.roleOptionTextSelected,
                        ]}
                      >
                        Officer
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.roleOption,
                        selectedStaffRole === "evidence_checker" &&
                          styles.roleOptionSelected,
                      ]}
                      onPress={() => setSelectedStaffRole("evidence_checker")}
                    >
                      <Text style={styles.roleOptionIcon}>🔍</Text>
                      <Text
                        style={[
                          styles.roleOptionText,
                          selectedStaffRole === "evidence_checker" &&
                            styles.roleOptionTextSelected,
                        ]}
                      >
                        Checker
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="e.g. System Administrator"
                    placeholderTextColor={colors.textSoft}
                    style={styles.input}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.loginTitle}>Staff Sign In</Text>
                <Text style={styles.loginSubtitle}>
                  Enter the credentials assigned to your authorized account.
                </Text>
              </>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Staff Email</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrorMessage("");
                }}
                placeholder="staff@justicenow.org"
                placeholderTextColor={colors.textSoft}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!loading}
                style={styles.input}
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage("");
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                editable={!loading}
                onSubmitEditing={
                  authMode === "signup"
                    ? handleStaffRegister
                    : handleStaffLogin
                }
                style={styles.input}
              />
            </View>

            {/* Error Message */}
            {errorMessage !== "" && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Success Message */}
            {successMessage !== "" && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              onPress={
                authMode === "signup" ? handleStaffRegister : handleStaffLogin
              }
              disabled={loading}
              accessibilityRole="button"
              style={[styles.primaryButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryText}>
                  {authMode === "signup"
                    ? `Create ${getRoleLabel(selectedStaffRole)} Account`
                    : "Sign in securely"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Roles Overview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Configured System Roles</Text>
            <RoleItem
              icon="⚙️"
              title="System Administrator"
              description="Manages roles, permissions, security policies, and accounts."
            />
            <View style={styles.divider} />
            <RoleItem
              icon="⚖️"
              title="Case Investigator / Officer"
              description="Reviews and investigates assigned human-rights cases."
            />
            <View style={styles.divider} />
            <RoleItem
              icon="🔍"
              title="Evidence Checker / Validator"
              description="Reviews submitted evidence and records validation decisions."
            />
          </View>

          {/* Regular Login Link */}
          <Pressable
            onPress={() => router.replace("/login")}
            accessibilityRole="button"
            style={styles.reporterButton}
          >
            <Text style={styles.reporterText}>Return to regular sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getRoleLabel(role: SystemRole): string {
  switch (role) {
    case "system_admin":
      return "System Admin";
    case "case_officer":
      return "Case Officer";
    case "evidence_checker":
      return "Evidence Checker";
    default:
      return "Reporter";
  }
}

function RoleItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.roleRow}>
      <View style={styles.roleIcon}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.roleContent}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 32,
    color: colors.navy[700],
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.royal[50],
  },
  icon: {
    fontSize: 27,
  },
  title: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },
  description: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  quickAccessCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.royal[50],
    borderWidth: 1,
    borderColor: colors.royal[200],
    marginBottom: 16,
  },
  quickAccessTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.royal[900],
  },
  quickAccessSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  quickButtonGrid: {
    flexDirection: "row",
    gap: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  adminQuickButton: {
    backgroundColor: "#FBF7EC",
    borderColor: "#E9D69D",
  },
  officerQuickButton: {
    backgroundColor: "#EFF4FF",
    borderColor: "#C0D4FD",
  },
  checkerQuickButton: {
    backgroundColor: "#EAF7F8",
    borderColor: "#A2E0E4",
  },
  quickButtonIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  quickButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[900],
    textAlign: "center",
  },
  loginCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.navy[50],
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabItemText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabItemTextActive: {
    color: colors.royal[700],
    fontWeight: "700",
  },
  loginTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  loginSubtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  rolePickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.navy[50],
  },
  roleOptionSelected: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },
  roleOptionIcon: {
    fontSize: 14,
  },
  roleOptionText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  roleOptionTextSelected: {
    color: colors.royal[800],
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    fontSize: 14,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  errorBox: {
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 10,
    backgroundColor: "#FFF2F1",
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.error,
  },
  successBox: {
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 10,
    backgroundColor: "#EAF7F8",
  },
  successText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.success,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
  card: {
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleIcon: {
    width: 42,
    height: 42,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  roleDescription: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: colors.border,
  },
  reporterButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  reporterText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.royal[700],
  },
});
