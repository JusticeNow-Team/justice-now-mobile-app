import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import {
    ActivityIndicator,
    Alert,
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

const CODE_LENGTH = 6;

type MfaMode = "loading" | "setup" | "verify";

export default function TwoFactorScreen() {
  const router = useRouter();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));

  const [mode, setMode] = useState<MfaMode>("loading");

  const [factorId, setFactorId] = useState("");

  const [secret, setSecret] = useState("");

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const refs = useRef<(TextInput | null)[]>([]);

  const complete =
    digits.length === CODE_LENGTH &&
    digits.every((digit) => /^[0-9]$/.test(digit));

  // -------------------------------------------------------
  // Prepare MFA
  // -------------------------------------------------------

  useEffect(() => {
    prepareMfa();
  }, []);

  const prepareMfa = async () => {
    try {
      setMode("loading");
      setErrorMessage("");

      // ---------------------------------------------------
      // Verify that a logged-in staff session exists
      // ---------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        await supabase.auth.signOut();

        router.replace("/secure-role");

        return;
      }

      console.log("MFA USER:", user.id);

      // ---------------------------------------------------
      // Check existing MFA factors
      // ---------------------------------------------------

      const { data: factors, error: factorError } =
        await supabase.auth.mfa.listFactors();

      console.log("MFA FACTORS:", factors);

      console.log("MFA FACTOR ERROR:", factorError);

      if (factorError) {
        throw factorError;
      }

      // ---------------------------------------------------
      // Find verified TOTP factor
      // ---------------------------------------------------

      const verifiedTotp = factors.totp.find(
        (factor) => factor.status === "verified",
      );

      if (verifiedTotp) {
        console.log("Existing verified TOTP factor found:", verifiedTotp.id);

        setFactorId(verifiedTotp.id);

        setMode("verify");

        return;
      }

      // ---------------------------------------------------
      // No verified MFA factor exists.
      // Start enrollment.
      // ---------------------------------------------------

      console.log("No verified TOTP factor. Starting enrollment.");

      const { data: enrollment, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",

          friendlyName: "JusticeNow Staff",
        });

      console.log("MFA ENROLLMENT:", enrollment);

      console.log("MFA ENROLL ERROR:", enrollError);

      if (enrollError) {
        throw enrollError;
      }

      setFactorId(enrollment.id);

      setSecret(enrollment.totp.secret);

      setMode("setup");
    } catch (error) {
      console.error("Prepare MFA error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not prepare multi-factor authentication.";

      setErrorMessage(message);

      setMode("verify");
    }
  };

  // -------------------------------------------------------
  // Update digit
  // -------------------------------------------------------

  const updateDigit = (value: string, index: number) => {
    setErrorMessage("");

    const cleaned = value.replace(/[^0-9]/g, "");

    // Allow complete code paste
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, CODE_LENGTH).split("");

      const updated = Array(CODE_LENGTH).fill("");

      pasted.forEach((digit, pastedIndex) => {
        updated[pastedIndex] = digit;
      });

      setDigits(updated);

      const focusIndex = Math.min(pasted.length, CODE_LENGTH) - 1;

      if (focusIndex >= 0) {
        refs.current[focusIndex]?.focus();
      }

      return;
    }

    const updated = [...digits];

    updated[index] = cleaned.slice(-1);

    setDigits(updated);

    if (cleaned && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  // -------------------------------------------------------
  // Backspace
  // -------------------------------------------------------

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  // -------------------------------------------------------
  // Route after MFA
  // -------------------------------------------------------

  const routeVerifiedStaff = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();

      router.replace("/secure-role");

      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();

      Alert.alert(
        "Profile error",
        "JusticeNow could not load your authorized staff role.",
      );

      router.replace("/secure-role");

      return;
    }

    console.log("MFA VERIFIED ROLE:", profile.role);

    // ---------------------------------------------------
    // Your Case Officer module
    // ---------------------------------------------------

    if (profile.role === "case_officer") {
      router.replace("/officer");

      return;
    }

    // ---------------------------------------------------
    // Other team modules are not connected yet
    // ---------------------------------------------------

    if (profile.role === "evidence_validator") {
      router.replace("/checker");
      return;
    }

    if (profile.role === "system_admin") {
      Alert.alert(
        "Administrator workspace",
        "The System Administrator module is not connected in this branch yet.",
      );

      router.replace("/login");

      return;
    }

    Alert.alert(
      "Access denied",
      "This account does not have an authorized JusticeNow staff role.",
    );

    router.replace("/login");
  };

  // -------------------------------------------------------
  // Verify authenticator code
  // -------------------------------------------------------

  const verifyCode = async () => {
    setErrorMessage("");

    if (!factorId) {
      setErrorMessage("JusticeNow could not determine your MFA factor.");

      return;
    }

    if (!complete) {
      setErrorMessage("Please enter all 6 digits from your authenticator app.");

      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      const code = digits.join("");

      console.log("Starting MFA challenge.");

      // ---------------------------------------------------
      // Create challenge
      // ---------------------------------------------------

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId,
        });

      console.log("MFA CHALLENGE:", challenge);

      console.log("MFA CHALLENGE ERROR:", challengeError);

      if (challengeError) {
        setErrorMessage(challengeError.message);

        return;
      }

      // ---------------------------------------------------
      // Verify the authenticator code
      // ---------------------------------------------------

      const { data: verification, error: verifyError } =
        await supabase.auth.mfa.verify({
          factorId,

          challengeId: challenge.id,

          code,
        });

      console.log("MFA VERIFICATION:", verification);

      console.log("MFA VERIFY ERROR:", verifyError);

      if (verifyError) {
        setErrorMessage(verifyError.message);

        Alert.alert("Verification failed", verifyError.message);

        return;
      }

      // ---------------------------------------------------
      // Confirm session reached AAL2
      // ---------------------------------------------------

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      console.log("AAL AFTER MFA:", aal);

      if (aalError) {
        setErrorMessage(aalError.message);

        return;
      }

      if (aal.currentLevel !== "aal2") {
        setErrorMessage(
          "Multi-factor authentication was not completed successfully.",
        );

        return;
      }

      // ---------------------------------------------------
      // MFA successful
      // ---------------------------------------------------

      console.log("STAFF MFA VERIFIED");

      await routeVerifiedStaff();
    } catch (error) {
      console.error("MFA verification error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not verify your security code.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Cancel
  // -------------------------------------------------------

  const handleCancel = async () => {
    await supabase.auth.signOut();

    router.replace("/secure-role");
  };

  // -------------------------------------------------------
  // Loading Screen
  // -------------------------------------------------------

  if (mode === "loading") {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Preparing secure verification...</Text>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel secure verification"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View>
          <Text style={styles.headerTitle}>Two-factor authentication</Text>

          <Text style={styles.headerSubtitle}>Secure staff verification</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          {mode === "setup" ? (
            <>
              <Text style={styles.title}>Set up your authenticator</Text>

              <Text style={styles.description}>
                This staff account does not have multi-factor authentication
                enabled yet. Add the secret below to an authenticator app such
                as Google Authenticator or Microsoft Authenticator.
              </Text>

              {/* Secret */}

              <View style={styles.secretContainer}>
                <Text style={styles.secretLabel}>AUTHENTICATOR SECRET</Text>

                <Text selectable style={styles.secret}>
                  {secret}
                </Text>
              </View>

              <Text style={styles.setupHelp}>
                In your authenticator app, choose to add an account manually and
                use this secret. Then enter the generated 6-digit code below.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Confirm it&apos;s you</Text>

              <Text style={styles.description}>
                Open the authenticator app linked to your JusticeNow staff
                account and enter the current 6-digit code.
              </Text>
            </>
          )}

          {/* OTP Boxes */}

          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  refs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(value) => updateDigit(value, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={index === 0 ? CODE_LENGTH : 1}
                selectTextOnFocus
                accessibilityLabel={`Authenticator code digit ${index + 1}`}
                style={[
                  styles.codeInput,

                  digit !== "" && styles.codeInputFilled,
                ]}
              />
            ))}
          </View>

          {/* Error */}

          {errorMessage !== "" && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
        </View>

        {/* Security */}

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🛡️</Text>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Extra protection for sensitive cases
            </Text>

            <Text style={styles.securityText}>
              Multi-factor authentication helps protect reports, evidence and
              investigation records even if a staff password is compromised.
            </Text>
          </View>
        </View>

        {/* Help */}

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Keep your authenticator secure</Text>

          <Text style={styles.helpText}>
            Never share your authenticator secret or verification code with
            another person.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}

      <View style={styles.footer}>
        <Pressable
          onPress={verifyCode}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Verify authenticator code"
          style={[
            styles.primaryButton,

            (!complete || loading) && styles.disabledButton,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Verify and continue</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleCancel}
          accessibilityRole="button"
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel staff sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: 12,

    fontSize: 13,

    color: colors.textSecondary,
  },

  header: {
    minHeight: 66,

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

  headerSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  content: {
    padding: 16,

    paddingBottom: 30,
  },

  card: {
    alignItems: "center",

    padding: 20,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 16,

    backgroundColor: colors.surface,
  },

  iconBox: {
    width: 58,
    height: 58,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 18,

    backgroundColor: colors.royal[50],
  },

  icon: {
    fontSize: 24,
  },

  title: {
    marginTop: 14,

    textAlign: "center",

    fontSize: 18,
    fontWeight: "700",

    color: colors.navy[800],
  },

  description: {
    marginTop: 6,

    textAlign: "center",

    fontSize: 13,
    lineHeight: 19,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Secret
  // -----------------------------------------------------

  secretContainer: {
    width: "100%",

    marginTop: 18,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  secretLabel: {
    textAlign: "center",

    fontSize: 9.5,
    fontWeight: "700",

    letterSpacing: 0.8,

    color: colors.royal[700],
  },

  secret: {
    marginTop: 8,

    textAlign: "center",

    fontSize: 15,
    fontWeight: "700",

    letterSpacing: 1,

    color: colors.navy[800],
  },

  setupHelp: {
    marginTop: 10,

    textAlign: "center",

    fontSize: 11,
    lineHeight: 16,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Code
  // -----------------------------------------------------

  codeRow: {
    flexDirection: "row",

    justifyContent: "center",

    gap: 7,

    marginTop: 22,
  },

  codeInput: {
    width: 43,
    height: 54,

    textAlign: "center",

    borderWidth: 1,
    borderColor: colors.navy[200],

    borderRadius: 11,

    fontSize: 20,
    fontWeight: "700",

    color: colors.navy[800],

    backgroundColor: colors.surface,
  },

  codeInputFilled: {
    borderColor: colors.royal[400],

    backgroundColor: colors.royal[50],
  },

  // -----------------------------------------------------
  // Error
  // -----------------------------------------------------

  errorBox: {
    width: "100%",

    marginTop: 16,

    padding: 10,

    borderWidth: 1,
    borderColor: colors.error,

    borderRadius: 10,

    backgroundColor: "#FFF2F1",
  },

  errorText: {
    textAlign: "center",

    fontSize: 11.5,
    lineHeight: 16,

    color: colors.error,
  },

  // -----------------------------------------------------
  // Security
  // -----------------------------------------------------

  securityNotice: {
    marginTop: 14,

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

  securityContent: {
    flex: 1,
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

  helpCard: {
    marginTop: 14,

    padding: 14,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: colors.border,

    backgroundColor: colors.surface,
  },

  helpTitle: {
    fontSize: 12.5,
    fontWeight: "700",

    color: colors.navy[800],
  },

  helpText: {
    marginTop: 4,

    fontSize: 11.5,
    lineHeight: 17,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Footer
  // -----------------------------------------------------

  footer: {
    padding: 14,

    borderTopWidth: 1,
    borderTopColor: colors.border,

    backgroundColor: colors.surface,
  },

  primaryButton: {
    minHeight: 50,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.royal[700],
  },

  disabledButton: {
    opacity: 0.45,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",

    color: colors.textInverse,
  },

  cancelButton: {
    minHeight: 42,

    marginTop: 5,

    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    fontSize: 12,

    fontWeight: "600",

    color: colors.textSecondary,
  },
});
