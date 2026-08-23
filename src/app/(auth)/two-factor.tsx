import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { resolvePostLoginRedirect } from "../../auth";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

const CODE_LENGTH = 6;
const PREPARE_TIMEOUT_MS = 12000;

type MfaMode = "loading" | "setup" | "verify" | "error";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export default function TwoFactorScreen() {
  const router = useRouter();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [mode, setMode] = useState<MfaMode>("loading");
  const [factorId, setFactorId] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("Preparing secure verification...");

  const refs = useRef<(TextInput | null)[]>([]);

  const complete =
    digits.length === CODE_LENGTH &&
    digits.every((digit) => /^[0-9]$/.test(digit));

  const handleCancel = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/secure-role");
  }, [router]);

  const routeVerifiedStaff = useCallback(async () => {
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
        "JusticeNow could not load your authorized staff role."
      );
      router.replace("/secure-role");
      return;
    }

    const redirect = resolvePostLoginRedirect(profile);

    if (!redirect.allowed) {
      await supabase.auth.signOut();
      Alert.alert(
        "Access denied",
        redirect.error ||
          "This account does not have an authorized JusticeNow staff role."
      );
      router.replace("/login");
      return;
    }

    if (profile.role === "case_officer") {
      router.replace("/officer");
      return;
    }

    if (profile.role === "evidence_validator") {
      router.replace("/checker");
      return;
    }

    if (profile.role === "system_admin") {
      router.replace("/admin");
      return;
    }

    await supabase.auth.signOut();
    Alert.alert(
      "Access denied",
      "This account does not have an authorized JusticeNow staff role."
    );
    router.replace("/login");
  }, [router]);

  const prepareMfa = useCallback(async () => {
    try {
      setMode("loading");
      setErrorMessage("");
      setSecret("");
      setFactorId("");
      setStatusMessage("Preparing secure verification...");

      const {
        data: { user },
        error: userError,
      } = await withTimeout(
        supabase.auth.getUser(),
        PREPARE_TIMEOUT_MS,
        "Timed out while checking your staff session."
      );

      if (userError || !user) {
        await supabase.auth.signOut();
        router.replace("/secure-role");
        return;
      }

      setStatusMessage("Checking your authenticator setup...");

      const { data: factors, error: factorError } = await withTimeout(
        supabase.auth.mfa.listFactors(),
        PREPARE_TIMEOUT_MS,
        "Timed out while loading your multi-factor authentication settings."
      );

      if (factorError) {
        throw factorError;
      }

      const verifiedTotp = factors.totp.find((factor) => factor.status === "verified");

      if (verifiedTotp) {
        setFactorId(verifiedTotp.id);
        setStatusMessage("Enter the code from your authenticator app.");
        setMode("verify");
        return;
      }

      const unverifiedTotp = factors.totp.find((factor) => factor.status !== "verified");
      if (unverifiedTotp) {
        setStatusMessage("Finishing your incomplete authenticator setup...");
      } else {
        setStatusMessage("Creating a new authenticator setup...");
      }

      const { data: enrollment, error: enrollError } = await withTimeout(
        supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "JusticeNow Staff",
        }),
        PREPARE_TIMEOUT_MS,
        "Timed out while creating your authenticator setup."
      );

      if (enrollError) {
        throw enrollError;
      }

      if (!enrollment?.id || !enrollment.totp?.secret) {
        throw new Error("Authenticator setup was created without a usable secret.");
      }

      setFactorId(enrollment.id);
      setSecret(enrollment.totp.secret);
      setStatusMessage("Add this secret to your authenticator app, then enter the code below.");
      setMode("setup");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not prepare multi-factor authentication.";

      setErrorMessage(message);
      setStatusMessage("We couldn't finish setting up secure verification.");
      setMode("error");
    }
  }, [router]);

  useEffect(() => {
    void prepareMfa();
  }, [prepareMfa]);

  const updateDigit = (value: string, index: number) => {
    setErrorMessage("");

    const cleaned = value.replace(/[^0-9]/g, "");

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

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

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

      const { data: challenge, error: challengeError } = await withTimeout(
        supabase.auth.mfa.challenge({ factorId }),
        PREPARE_TIMEOUT_MS,
        "Timed out while requesting your verification challenge."
      );

      if (challengeError) {
        throw challengeError;
      }

      const { error: verifyError } = await withTimeout(
        supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        }),
        PREPARE_TIMEOUT_MS,
        "Timed out while verifying your authenticator code."
      );

      if (verifyError) {
        throw verifyError;
      }

      const { data: aal, error: aalError } = await withTimeout(
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        PREPARE_TIMEOUT_MS,
        "Timed out while confirming your secure session."
      );

      if (aalError) {
        throw aalError;
      }

      if (aal.currentLevel !== "aal2") {
        throw new Error("Multi-factor authentication was not completed successfully.");
      }

      await routeVerifiedStaff();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not verify your security code.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === "loading") {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />
        <Text style={styles.loadingText}>{statusMessage}</Text>
        <Pressable
          onPress={prepareMfa}
          accessibilityRole="button"
          style={styles.loadingRetryButton}
        >
          <Text style={styles.loadingRetryText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

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
                This staff account does not have multi-factor authentication enabled yet.
                Add the secret below to an authenticator app such as Google Authenticator
                or Microsoft Authenticator.
              </Text>

              <View style={styles.secretContainer}>
                <Text style={styles.secretLabel}>AUTHENTICATOR SECRET</Text>
                <Text selectable style={styles.secret}>
                  {secret}
                </Text>
              </View>

              <Text style={styles.setupHelp}>
                In your authenticator app, choose to add an account manually and use
                this secret. Then enter the generated 6-digit code below.
              </Text>
            </>
          ) : mode === "error" ? (
            <>
              <Text style={styles.title}>Secure verification unavailable</Text>
              <Text style={styles.description}>{statusMessage}</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
              <Pressable
                onPress={prepareMfa}
                accessibilityRole="button"
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Retry secure verification</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Confirm it's you</Text>
              <Text style={styles.description}>
                Open the authenticator app linked to your JusticeNow staff account and
                enter the current 6-digit code.
              </Text>
            </>
          )}

          {mode !== "error" ? (
            <>
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

              {errorMessage !== "" ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🛡️</Text>
          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Extra protection for sensitive cases</Text>
            <Text style={styles.securityText}>
              Multi-factor authentication helps protect reports, evidence and
              investigation records even if a staff password is compromised.
            </Text>
          </View>
        </View>

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Keep your authenticator secure</Text>
          <Text style={styles.helpText}>
            Never share your authenticator secret or verification code with another
            person.
          </Text>
        </View>
      </ScrollView>

      {mode !== "error" ? (
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
      ) : null}
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
    padding: 24,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
    color: colors.textSecondary,
  },
  loadingRetryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loadingRetryText: {
    color: colors.royal[700],
    fontSize: 13,
    fontWeight: "700",
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
    width: "100%",
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
