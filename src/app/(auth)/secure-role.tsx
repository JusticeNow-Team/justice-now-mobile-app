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
import { resolvePostLoginRedirect } from "../../auth";
import { UserProfile } from "../../auth/types";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

export default function SecureRoleScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // -------------------------------------------------------
  // Route verified staff by their database role
  // -------------------------------------------------------
  const routeStaff = async (
    roleOrProfile: string | Partial<UserProfile> | null | undefined
  ) => {
    const redirect = resolvePostLoginRedirect(roleOrProfile);

    if (!redirect.allowed) {
      await supabase.auth.signOut();
      Alert.alert(
        "Access denied",
        redirect.error || "This account does not have an authorized JusticeNow staff role."
      );
      return;
    }

    router.replace(redirect.targetRoute as any);
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
          "This is a Reporter account. Please use regular citizen sign in instead."
        );
        return;
      }

      const allowedStaffRoles = [
        "case_officer",
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
        await routeStaff(profile);
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
              Sign in to access the System Admin, Case Officer, or Evidence Checker
              workspaces.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Staff Sign In</Text>
            <Text style={styles.loginSubtitle}>
              Enter the credentials assigned to your authorized account.
            </Text>

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
                onSubmitEditing={handleStaffLogin}
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
              onPress={handleStaffLogin}
              disabled={loading}
              accessibilityRole="button"
              style={[styles.primaryButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryText}>Sign in securely</Text>
              )}
            </Pressable>
          </View>

          {/* Role Info Notice */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Staff Accounts Are Provisioned by Administrators
              </Text>
              <Text style={styles.infoText}>
                Staff members cannot self-register. System Administrators create
                and invite Case Officers and Evidence Checkers through the Admin
                Management portal.
              </Text>
            </View>
          </View>

          {/* Configured System Roles Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Authorized Staff Roles</Text>
            <RoleItem
              icon="⚙️"
              title="System Administrator"
              description="Manages staff accounts, roles, report categories, and security policies."
            />
            <View style={styles.divider} />
            <RoleItem
              icon="⚖️"
              title="Case Investigator / Officer"
              description="Reviews and investigates assigned human-rights cases and tracks status."
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
  loginCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    marginBottom: 14,
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
  infoCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
    marginBottom: 14,
    gap: 10,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[900],
    marginBottom: 3,
  },
  infoText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  card: {
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
