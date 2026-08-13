import { useRouter } from "expo-router";
import { useState } from "react";

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

import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

export default function SecureRoleScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // -------------------------------------------------------
  // Route verified staff by their REAL database role
  // -------------------------------------------------------

  const routeStaff = async (role: string) => {
    if (role === "case_officer") {
      router.replace("/officer");
      return;
    }

    if (role === "evidence_validator") {
      await supabase.auth.signOut();

      Alert.alert(
        "Validator workspace",
        "The Evidence Validator module is not connected in this branch yet.",
      );

      return;
    }

    if (role === "system_admin") {
      await supabase.auth.signOut();

      Alert.alert(
        "Administrator workspace",
        "The System Administrator module is not connected in this branch yet.",
      );

      return;
    }

    await supabase.auth.signOut();

    Alert.alert(
      "Access denied",
      "This account does not have an authorized JusticeNow staff role.",
    );
  };

  // -------------------------------------------------------
  // Staff Login
  // -------------------------------------------------------

  const handleStaffLogin = async () => {
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Please enter your staff email address.");

      return;
    }

    if (!password) {
      setErrorMessage("Please enter your staff account password.");

      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      console.log("STAFF LOGIN ATTEMPT:", cleanEmail);

      // ---------------------------------------------------
      // First authentication factor: email + password
      // ---------------------------------------------------

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      console.log("STAFF LOGIN USER:", data.user?.id);

      console.log("STAFF LOGIN ERROR:", error);

      if (error) {
        setErrorMessage(error.message);

        Alert.alert("Staff sign in failed", error.message);

        return;
      }

      if (!data.user) {
        setErrorMessage(
          "JusticeNow could not authenticate this staff account.",
        );

        return;
      }

      // ---------------------------------------------------
      // Load role securely from profiles
      // ---------------------------------------------------

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .single();

      console.log("STAFF PROFILE:", profile);

      console.log("STAFF PROFILE ERROR:", profileError);

      if (profileError || !profile) {
        await supabase.auth.signOut();

        setErrorMessage("JusticeNow could not load your staff profile.");

        Alert.alert(
          "Staff profile error",
          "JusticeNow could not load your authorized staff profile.",
        );

        return;
      }

      // ---------------------------------------------------
      // Regular reporters cannot enter staff flow
      // ---------------------------------------------------

      if (profile.role === "reporter") {
        await supabase.auth.signOut();

        Alert.alert(
          "Staff access only",
          "This is a Reporter account. Please use regular sign in instead.",
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

      console.log("AUTHORIZED STAFF ROLE:", profile.role);

      // ---------------------------------------------------
      // Check MFA assurance level
      // ---------------------------------------------------

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      console.log("STAFF AAL:", aal);

      console.log("STAFF AAL ERROR:", aalError);

      if (aalError) {
        await supabase.auth.signOut();

        Alert.alert("Security check failed", aalError.message);

        return;
      }

      // ---------------------------------------------------
      // Already completed MFA in current session
      // ---------------------------------------------------

      if (aal.currentLevel === "aal2") {
        console.log("Staff session already at AAL2");

        await routeStaff(profile.role);

        return;
      }

      // ---------------------------------------------------
      // Need MFA enrollment or verification
      // ---------------------------------------------------

      router.push("/two-factor");
    } catch (error) {
      console.error("Unexpected staff login error:", error);

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

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

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
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Staff access</Text>
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

            <Text style={styles.title}>Secure JusticeNow staff access</Text>

            <Text style={styles.description}>
              Authorized staff must authenticate with their approved JusticeNow
              account before accessing sensitive case and investigation data.
            </Text>
          </View>

          {/* Staff Login Form */}

          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Staff sign in</Text>

            <Text style={styles.loginSubtitle}>
              Use the email and password assigned to your approved staff
              account.
            </Text>

            {/* Email */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Staff email</Text>

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

            {/* Error */}

            {errorMessage !== "" && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Sign In */}

            <Pressable
              onPress={handleStaffLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in to staff workspace"
              style={[styles.primaryButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.primaryText}>Continue securely</Text>
              )}
            </Pressable>
          </View>

          {/* Roles */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Authorized staff roles</Text>

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

            <View style={styles.divider} />

            <RoleItem
              icon="⚙️"
              title="System Administrator"
              description="Manages accounts, permissions, security and system configuration."
            />
          </View>

          {/* Role Info */}

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Roles are assigned by JusticeNow
              </Text>

              <Text style={styles.infoText}>
                Staff cannot select or change their role during sign in.
                JusticeNow loads the authorized role from the account profile.
              </Text>
            </View>
          </View>

          {/* MFA Info */}

          <View style={styles.securityCard}>
            <Text style={styles.securityIcon}>🔐</Text>

            <View style={styles.infoContent}>
              <Text style={styles.securityTitle}>
                Multi-factor authentication
              </Text>

              <Text style={styles.securityText}>
                After your password is verified, JusticeNow will require an
                authenticator code before allowing access to the protected staff
                workspace.
              </Text>
            </View>
          </View>

          {/* Regular login */}

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

  // -------------------------------------------------------
  // Login
  // -------------------------------------------------------

  loginCard: {
    padding: 16,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 16,

    backgroundColor: colors.surface,
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

  // -------------------------------------------------------
  // Roles
  // -------------------------------------------------------

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

  // -------------------------------------------------------
  // Information
  // -------------------------------------------------------

  infoCard: {
    marginTop: 14,

    flexDirection: "row",

    padding: 14,

    borderWidth: 1,
    borderColor: colors.royal[100],

    borderRadius: 14,

    backgroundColor: colors.royal[50],
  },

  infoIcon: {
    marginRight: 9,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 12.5,
    fontWeight: "700",

    color: colors.royal[800],
  },

  infoText: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 17,

    color: colors.textSecondary,
  },

  securityCard: {
    marginTop: 10,

    flexDirection: "row",

    padding: 14,

    borderWidth: 1,
    borderColor: colors.teal[100],

    borderRadius: 14,

    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 9,
  },

  securityTitle: {
    fontSize: 12.5,
    fontWeight: "700",

    color: colors.teal[800],
  },

  securityText: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 17,

    color: colors.teal[800],
  },

  reporterButton: {
    minHeight: 46,

    marginTop: 10,

    alignItems: "center",
    justifyContent: "center",
  },

  reporterText: {
    fontSize: 12.5,
    fontWeight: "600",

    color: colors.royal[700],
  },
});
