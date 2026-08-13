import { useRouter } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
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

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  // -------------------------------------------------------
  // Sign In
  // -------------------------------------------------------

  const handleSignIn = async () => {
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      console.log("Attempting login:", cleanEmail);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      console.log("LOGIN USER:", data.user?.id);
      console.log("LOGIN ERROR:", error);

      if (error) {
        setErrorMessage(error.message);

        Alert.alert(
          "Sign in failed",
          error.message
        );

        return;
      }

      if (!data.user) {
        setErrorMessage(
          "JusticeNow could not sign you in."
        );

        return;
      }

      // ---------------------------------------------------
      // Load profile role
      // ---------------------------------------------------

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      console.log("PROFILE:", profile);
      console.log("PROFILE ERROR:", profileError);

      if (profileError) {
        await supabase.auth.signOut();

        setErrorMessage(
          "Your account was authenticated, but JusticeNow could not load your profile."
        );

        Alert.alert(
          "Profile error",
          "Your account was authenticated, but JusticeNow could not load your profile."
        );

        return;
      }

      if (!profile) {
        await supabase.auth.signOut();

        setErrorMessage(
          "JusticeNow could not find your user profile."
        );

        return;
      }

      console.log(
        "SIGNED IN ROLE:",
        profile.role
      );

      // ---------------------------------------------------
      // Reporter
      // ---------------------------------------------------

      if (profile.role === "reporter") {
        console.log(
          "Reporter successfully authenticated."
        );

        router.replace("/reporter");

        return;
      }

      // ---------------------------------------------------
      // Staff users
      // ---------------------------------------------------

      await supabase.auth.signOut();

      Alert.alert(
        "Staff account detected",
        "Please use Staff access to sign in with your JusticeNow staff account.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Staff access",
            onPress: () =>
              router.push("/secure-role"),
          },
        ]
      );
    } catch (error) {
      console.error(
        "Unexpected login error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.";

      setErrorMessage(message);

      Alert.alert(
        "Connection error",
        message
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Anonymous Reporter
  // -------------------------------------------------------

  const handleAnonymous = () => {
    Alert.alert(
      "Anonymous reporting",
      "Anonymous reporting will be connected when we implement the case reporting flow."
    );
  };

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}

          <View style={styles.brandSection}>
            <Image
              source={require(
                "../../../assets/images/justicenow-logo-mark.png"
              )}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="JusticeNow logo"
            />

            <Text style={styles.welcomeTitle}>
              Welcome to Justice
              <Text style={styles.nowText}>
                Now
              </Text>
            </Text>

            <Text style={styles.tagline}>
              Report Safely. Track Transparently.
              Seek Justice.
            </Text>
          </View>

          {/* Login Card */}

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Email
              </Text>

              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrorMessage("");
                }}
                placeholder="you@example.com"
                placeholderTextColor={
                  colors.textSoft
                }
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
              <Text style={styles.label}>
                Password
              </Text>

              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage("");
                }}
                placeholder="Enter your password"
                placeholderTextColor={
                  colors.textSoft
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                editable={!loading}
                onSubmitEditing={handleSignIn}
                style={styles.input}
              />
            </View>

            {errorMessage !== "" && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            )}

            <View style={styles.optionsRow}>
              <Pressable
                onPress={() =>
                  setRememberMe(
                    (current) => !current
                  )
                }
                style={styles.rememberRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe &&
                      styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Text style={styles.checkmark}>
                      ✓
                    </Text>
                  )}
                </View>

                <Text style={styles.rememberText}>
                  Remember me
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push(
                    "/forgot-password"
                  )
                }
              >
                <Text style={styles.linkText}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={loading}
              style={[
                styles.signInButton,
                loading &&
                  styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.textInverse}
                />
              ) : (
                <Text style={styles.signInText}>
                  Sign in
                </Text>
              )}
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={styles.mutedText}>
                New to JusticeNow?{" "}
              </Text>

              <Pressable
                onPress={() =>
                  router.push("/register")
                }
              >
                <Text style={styles.linkText}>
                  Create an account
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Divider */}

          <View style={styles.dividerRow}>
            <View style={styles.divider} />

            <Text style={styles.orText}>
              OR
            </Text>

            <View style={styles.divider} />
          </View>

          {/* Anonymous */}

          <Pressable
            onPress={handleAnonymous}
            style={styles.anonymousButton}
          >
            <Text style={styles.anonymousIcon}>
              ◯
            </Text>

            <Text style={styles.anonymousText}>
              Continue as anonymous reporter
            </Text>
          </Pressable>

          {/* Privacy */}

          <View style={styles.privacyNotice}>
            <Text style={styles.lockIcon}>
              🔒
            </Text>

            <Text style={styles.privacyText}>
              Anonymous reports are accepted and
              investigated. Your name, contact
              details and device information are
              never attached to the case.
            </Text>
          </View>

          {/* Staff */}

          <View style={styles.staffSection}>
            <Text style={styles.staffText}>
              Signing in as staff?{" "}
            </Text>

            <Pressable
              onPress={() =>
                router.push("/secure-role")
              }
            >
              <Text style={styles.linkText}>
                Staff access
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },

  brandSection: {
    alignItems: "center",
    paddingBottom: 24,
  },

  logo: {
    width: 56,
    height: 56,
  },

  welcomeTitle: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy[800],
  },

  nowText: {
    color: colors.royal[600],
  },

  tagline: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 13,
    color: colors.textSecondary,
  },

  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  fieldGroup: {
    marginBottom: 14,
  },

  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
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

  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
  },

  checkbox: {
    width: 20,
    height: 20,
    marginRight: 8,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.navy[300],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  checkboxChecked: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },

  checkmark: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },

  rememberText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy[800],
  },

  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.royal[700],
  },

  signInButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  signInText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textInverse,
  },

  registerRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  mutedText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  orText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSoft,
  },

  anonymousButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },

  anonymousIcon: {
    fontSize: 16,
    color: colors.navy[700],
  },

  anonymousText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[700],
  },

  privacyNotice: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.teal[100],
    backgroundColor: colors.teal[50],
  },

  lockIcon: {
    marginRight: 9,
    fontSize: 14,
  },

  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.teal[800],
  },

  staffSection: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
  },

  staffText: {
    fontSize: 11.5,
    color: colors.textSoft,
  },
});