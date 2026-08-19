import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

type RecoveryLinkStatus =
  | "checking"
  | "ready"
  | "error";

type RecoveryParameters = {
  accessToken: string | null;
  code: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
};

function getRecoveryParameters(
  url: string
): RecoveryParameters {
  const hashIndex = url.indexOf("#");
  const urlWithoutHash =
    hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : "";

  const queryIndex = urlWithoutHash.indexOf("?");
  const query =
    queryIndex >= 0
      ? urlWithoutHash.slice(queryIndex + 1)
      : "";

  const queryParameters = new URLSearchParams(query);
  const hashParameters = new URLSearchParams(hash);

  const getValue = (key: string) =>
    hashParameters.get(key) ??
    queryParameters.get(key);

  return {
    accessToken: getValue("access_token"),
    code: getValue("code"),
    errorCode: getValue("error_code") ?? getValue("error"),
    errorDescription: getValue("error_description"),
    refreshToken: getValue("refresh_token"),
    tokenHash: getValue("token_hash"),
    type: getValue("type"),
  };
}

function getLinkErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : String(error);
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("otp_expired")
  ) {
    return "This recovery link has expired. Request a new link and try again.";
  }

  return "This recovery link is invalid or could not be verified. Request a new link and try again.";
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const recoveryUrl = Linking.useLinkingURL();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [linkStatus, setLinkStatus] =
    useState<RecoveryLinkStatus>("checking");
  const [linkError, setLinkError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordUpdated, setPasswordUpdated] =
    useState(false);
  const [mfaRequired, setMfaRequired] =
    useState(false);
  const [mfaFactorId, setMfaFactorId] =
    useState("");
  const [mfaCode, setMfaCode] = useState("");

  const handledUrlRef = useRef<string | null>(null);
  const redirectTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifyRecoveryLink = async () => {
      if (!recoveryUrl) {
        setLinkError(
          "Open this screen from the password-recovery link sent to your email."
        );
        setLinkStatus("error");
        return;
      }

      if (handledUrlRef.current === recoveryUrl) {
        return;
      }

      handledUrlRef.current = recoveryUrl;
      setLinkError("");
      setLinkStatus("checking");

      try {
        const parameters =
          getRecoveryParameters(recoveryUrl);

        if (
          parameters.errorCode ||
          parameters.errorDescription
        ) {
          throw new Error(
            parameters.errorDescription ??
              parameters.errorCode ??
              "Invalid recovery link"
          );
        }

        if (parameters.code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(
              parameters.code
            );

          if (error) {
            throw error;
          }
        } else if (
          parameters.accessToken &&
          parameters.refreshToken &&
          parameters.type === "recovery"
        ) {
          const { error } =
            await supabase.auth.setSession({
              access_token: parameters.accessToken,
              refresh_token: parameters.refreshToken,
            });

          if (error) {
            throw error;
          }
        } else if (
          parameters.tokenHash &&
          parameters.type === "recovery"
        ) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: parameters.tokenHash,
            type: "recovery",
          });

          if (error) {
            throw error;
          }
        } else {
          throw new Error("Invalid recovery link");
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw (
            sessionError ??
            new Error("Recovery session was not created")
          );
        }

        const { data: aal, error: aalError } =
          await supabase.auth.mfa
            .getAuthenticatorAssuranceLevel();

        if (aalError) {
          throw aalError;
        }

        const needsMfa =
          aal.currentLevel !== "aal2" &&
          aal.nextLevel === "aal2";

        if (needsMfa) {
          const {
            data: factors,
            error: factorsError,
          } = await supabase.auth.mfa.listFactors();

          if (factorsError) {
            throw factorsError;
          }

          const verifiedTotp = factors.totp.find(
            (factor) => factor.status === "verified"
          );

          if (!verifiedTotp) {
            throw new Error(
              "This account requires multi-factor authentication, but no verified authenticator factor is available."
            );
          }

          if (!cancelled) {
            setMfaFactorId(verifiedTotp.id);
            setMfaRequired(true);
          }
        } else if (!cancelled) {
          setMfaFactorId("");
          setMfaRequired(false);
        }

        if (!cancelled) {
          setLinkStatus("ready");
        }
      } catch (error) {
        console.error(
          "Password recovery link verification failed:",
          error
        );

        if (!cancelled) {
          setLinkError(getLinkErrorMessage(error));
          setLinkStatus("error");
        }
      }
    };

    void verifyRecoveryLink();

    return () => {
      cancelled = true;
    };
  }, [recoveryUrl]);

  const rules = [
    {
      label: "At least 10 characters",
      met: password.length >= 10,
    },
    {
      label: "Contains a number",
      met: /\d/.test(password),
    },
    {
      label: "Contains an uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Passwords match",
      met:
        password.length > 0 &&
        password === confirmPassword,
    },
  ];

  const valid = rules.every((rule) => rule.met);
  const mfaCodeValid =
    !mfaRequired || /^\d{6}$/.test(mfaCode);

  const handleSavePassword = async () => {
    if (
      !valid ||
      !mfaCodeValid ||
      loading ||
      linkStatus !== "ready"
    ) {
      return;
    }

    setSubmitError("");

    try {
      setLoading(true);

      if (mfaRequired) {
        if (!mfaFactorId) {
          throw new Error(
            "JusticeNow could not find your authenticator factor. Request a new recovery link and try again."
          );
        }

        const {
          data: challenge,
          error: challengeError,
        } = await supabase.auth.mfa.challenge({
          factorId: mfaFactorId,
        });

        if (challengeError) {
          throw challengeError;
        }

        const { error: verifyError } =
          await supabase.auth.mfa.verify({
            factorId: mfaFactorId,
            challengeId: challenge.id,
            code: mfaCode,
          });

        if (verifyError) {
          throw verifyError;
        }

        const {
          data: verifiedAal,
          error: verifiedAalError,
        } = await supabase.auth.mfa
          .getAuthenticatorAssuranceLevel();

        if (verifiedAalError) {
          throw verifiedAalError;
        }

        if (verifiedAal.currentLevel !== "aal2") {
          throw new Error(
            "Multi-factor authentication was not completed successfully."
          );
        }
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setPasswordUpdated(true);

      const { error: signOutError } =
        await supabase.auth.signOut({ scope: "global" });

      if (signOutError) {
        console.warn(
          "Global sign out after password recovery failed:",
          signOutError
        );
        await supabase.auth.signOut({ scope: "local" });
      }

      redirectTimerRef.current = setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (error) {
      console.error("Password update failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to update your password. Please try again.";

      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (linkStatus === "ready") {
      await supabase.auth.signOut({ scope: "local" });
    }

    router.replace("/login");
  };

  const renderContent = () => {
    if (linkStatus === "checking") {
      return (
        <View style={styles.stateCard}>
          <ActivityIndicator
            size="large"
            color={colors.royal[700]}
          />
          <Text style={styles.stateTitle}>
            Verifying your recovery link
          </Text>
          <Text style={styles.stateDescription}>
            This should only take a moment.
          </Text>
        </View>
      );
    }

    if (linkStatus === "error") {
      return (
        <View style={styles.stateCard}>
          <View style={styles.errorIconBox}>
            <Text style={styles.errorIcon}>!</Text>
          </View>
          <Text style={styles.stateTitle}>
            Recovery link unavailable
          </Text>
          <Text style={styles.stateDescription}>
            {linkError}
          </Text>
          <Pressable
            onPress={() =>
              router.replace("/forgot-password")
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              Request a new link
            </Text>
          </Pressable>
        </View>
      );
    }

    if (passwordUpdated) {
      return (
        <View style={styles.stateCard}>
          <View style={styles.successIconBox}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.stateTitle}>
            Password updated
          </Text>
          <Text style={styles.stateDescription}>
            Your new password is ready. Returning you to
            sign in…
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.label}>
            New password
          </Text>

          <TextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setSubmitError("");
            }}
            secureTextEntry
            placeholder="Enter a new password"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            style={styles.input}
          />

          <Text style={styles.label}>
            Confirm new password
          </Text>

          <TextInput
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setSubmitError("");
            }}
            secureTextEntry
            placeholder="Re-enter the new password"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            onSubmitEditing={handleSavePassword}
            style={styles.input}
          />

          <View style={styles.ruleList}>
            {rules.map((rule) => (
              <View
                key={rule.label}
                style={styles.ruleRow}
              >
                <Text
                  style={[
                    styles.ruleIcon,
                    rule.met && styles.ruleMet,
                  ]}
                >
                  ✓
                </Text>

                <Text
                  style={[
                    styles.ruleText,
                    rule.met && styles.ruleTextMet,
                  ]}
                >
                  {rule.label}
                </Text>
              </View>
            ))}
          </View>

          {mfaRequired && (
            <View style={styles.mfaCard}>
              <Text style={styles.mfaTitle}>
                Authenticator verification required
              </Text>

              <Text style={styles.mfaDescription}>
                This account has multi-factor
                authentication enabled. Enter the current
                6-digit code from the authenticator app
                before changing the password.
              </Text>

              <TextInput
                value={mfaCode}
                onChangeText={(value) => {
                  setMfaCode(
                    value.replace(/[^0-9]/g, "").slice(0, 6)
                  );
                  setSubmitError("");
                }}
                placeholder="000000"
                placeholderTextColor={colors.textSoft}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                editable={!loading}
                accessibilityLabel="Authenticator code"
                style={styles.mfaInput}
              />
            </View>
          )}

          {submitError !== "" && (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
            >
              <Text style={styles.errorText}>
                {submitError}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.helpText}>
          After saving, your recovery session will close
          and you can sign in with the new password.
        </Text>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleCancel}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel password recovery"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Create a new password
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}
        </ScrollView>

        {linkStatus === "ready" && !passwordUpdated && (
          <View style={styles.footer}>
            <Pressable
              disabled={!valid || !mfaCodeValid || loading}
              onPress={handleSavePassword}
              style={[
                styles.primaryButton,
                (!valid || !mfaCodeValid || loading) &&
                  styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.textInverse}
                />
              ) : (
                <Text style={styles.primaryText}>
                  {mfaRequired
                    ? "Verify and save password"
                    : "Save new password"}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flex: {
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
    flexGrow: 1,
    padding: 16,
  },

  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },

  input: {
    minHeight: 48,
    marginBottom: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    fontSize: 14,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },

  ruleList: {
    marginTop: 2,
    gap: 8,
  },

  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  ruleIcon: {
    width: 20,
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[200],
  },

  ruleMet: {
    color: colors.success,
  },

  ruleText: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },

  ruleTextMet: {
    fontWeight: "500",
    color: colors.success,
  },

  mfaCard: {
    marginTop: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.royal[300],
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },

  mfaTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },

  mfaDescription: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  mfaInput: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.royal[300],
    borderRadius: 10,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 8,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },

  errorBox: {
    marginTop: 14,
    padding: 11,
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

  helpText: {
    marginTop: 16,
    paddingHorizontal: 3,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  stateCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  stateTitle: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },

  stateDescription: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  errorIconBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#FFF2F1",
  },

  errorIcon: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.error,
  },

  successIconBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.teal[50],
  },

  successIcon: {
    fontSize: 25,
    fontWeight: "700",
    color: colors.success,
  },

  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.royal[500],
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.royal[700],
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
  },

  disabled: {
    opacity: 0.4,
  },

  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
});