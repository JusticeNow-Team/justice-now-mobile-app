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

import { hasCompletedStaffMfa, resolvePostLoginRedirect } from "../../auth";
import { UserProfile } from "../../auth/types";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { supabase } from "../../lib/supabase";
import { colors, iconSizes } from "../../theme";

type StaffRoleItem = {
  icon: AppIconName;
  title: string;
  description: string;
};

const STAFF_ROLES: StaffRoleItem[] = [
  {
    icon: "settings",
    title: "System Administrator",
    description:
      "Manages staff accounts, roles, report categories, and security policies.",
  },
  {
    icon: "balance",
    title: "Case Investigator / Officer",
    description:
      "Reviews and investigates assigned human-rights cases and tracks status.",
  },
  {
    icon: "search",
    title: "Evidence Checker / Validator",
    description:
      "Reviews submitted evidence and records validation decisions.",
  },
];

export default function SecureRoleScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const routeStaff = async (
    roleOrProfile: string | Partial<UserProfile> | null | undefined,
  ) => {
    const redirect = resolvePostLoginRedirect(roleOrProfile);

    if (!redirect.allowed) {
      await supabase.auth.signOut();
      Alert.alert(
        "Access denied",
        redirect.error ||
          "This account does not have an authorized JusticeNow staff role.",
      );
      return;
    }

    router.replace(redirect.targetRoute as any);
  };

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
          "JusticeNow could not load your authorized staff profile.",
        );
        return;
      }

      if (profile.role === "reporter") {
        await supabase.auth.signOut();
        Alert.alert(
          "Staff access only",
          "This is a Reporter account. Please use regular citizen sign in instead.",
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
          "This account does not have an authorized JusticeNow staff role.",
        );
        return;
      }

      const mfa = await hasCompletedStaffMfa();

      if (mfa.error) {
        await supabase.auth.signOut();
        Alert.alert("Security check failed", mfa.error.message);
        return;
      }

      if (mfa.verified) {
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
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <AppIcon
              name="chevron-left"
              size={iconSizes.headerBack}
              color={colors.navy[600]}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Staff & Admin Portal</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.iconBox}>
              <AppIcon name="shield" size={iconSizes.xl} color={colors.royal[700]} />
            </View>
            <Text style={styles.title}>JusticeNow Staff Access</Text>
            <Text style={styles.description}>
              Sign in to access the System Admin, Case Officer, or Evidence
              Checker workspaces.
            </Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Staff Sign In</Text>
            <Text style={styles.loginSubtitle}>
              Enter the credentials assigned to your authorized account.
            </Text>

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

            {errorMessage !== "" ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage !== "" ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

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

          <View style={styles.infoCard}>
            <AppIcon name="info" size={iconSizes.md} color={colors.navy[900]} />
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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Authorized Staff Roles</Text>
            {STAFF_ROLES.map((roleItem, index) => (
              <React.Fragment key={roleItem.title}>
                <RoleItem {...roleItem} />
                {index < STAFF_ROLES.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>

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

function RoleItem({ icon, title, description }: StaffRoleItem) {
  return (
    <View style={styles.roleRow}>
      <View style={styles.roleIcon}>
        <AppIcon name={icon} size={iconSizes.md} color={colors.navy[800]} />
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
