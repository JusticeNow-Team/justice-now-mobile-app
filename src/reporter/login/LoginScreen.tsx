import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppTextInput,
  AuthScreen,
  CheckboxRow,
  Field,
  Notice,
  PrimaryButton,
} from "../../components/common";
import { colors } from "../../theme";
import { loginReporter } from "./loginReporter";
import {
  hasLoginErrors,
  LoginErrors,
  validateReporterLogin,
} from "./validation";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState("");
  const [staffPrompt, setStaffPrompt] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const clearFieldError = (field: keyof LoginErrors) => {
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const handleSignIn = async () => {
    setFormError("");
    setStaffPrompt(false);
    setInfoMessage("");

    const nextErrors = validateReporterLogin({ email, password });
    setErrors(nextErrors);

    if (hasLoginErrors(nextErrors) || loading) {
      return;
    }

    try {
      setLoading(true);

      const result = await loginReporter(email, password);

      if (!result.ok) {
        setFormError(result.message);
        setStaffPrompt(result.reason === "staff");
        return;
      }

      router.replace("/reporter");
    } catch {
      setFormError(
        "Unable to sign in. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen>
      <View style={styles.brandSection}>
        <Image
          source={require("../../../assets/images/justicenow-logo-mark.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="JusticeNow logo"
        />
        <Text style={styles.welcomeTitle}>
          Welcome to Justice
          <Text style={styles.nowText}>Now</Text>
        </Text>
        <Text style={styles.tagline}>
          Report Safely. Track Transparently. Seek Justice.
        </Text>
      </View>

      <View style={styles.card}>
        <Field label="Email or username" error={errors.email}>
          <AppTextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearFieldError("email");
              setFormError("");
              setStaffPrompt(false);
              setInfoMessage("");
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!loading}
            invalid={Boolean(errors.email)}
            accessibilityLabel="Email or username"
          />
        </Field>

        <Field label="Password" error={errors.password}>
          <AppTextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearFieldError("password");
              setFormError("");
            }}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            editable={!loading}
            onSubmitEditing={handleSignIn}
            invalid={Boolean(errors.password)}
            accessibilityLabel="Password"
          />
        </Field>

        {formError ? (
          <View style={styles.noticeWrap}>
            <Notice
              tone="error"
              title={
                staffPrompt ? "Staff account detected" : "Unable to sign in"
              }
            >
              {formError}
            </Notice>
          </View>
        ) : null}

        <View style={styles.optionsRow}>
          <CheckboxRow
            compact
            checked={rememberMe}
            onPress={() => setRememberMe((current) => !current)}
            label="Remember me"
          />
          <Pressable
            onPress={() => router.push("/forgot-password")}
            accessibilityRole="button"
            accessibilityLabel="Forgot password?"
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>
        </View>

        <PrimaryButton
          title="Sign in"
          onPress={handleSignIn}
          loading={loading}
        />

        {staffPrompt ? (
          <View style={styles.staffCta}>
            <PrimaryButton
              title="Staff access"
              variant="outline"
              onPress={() => router.push("/secure-role")}
            />
          </View>
        ) : null}

        <View style={styles.registerRow}>
          <Text style={styles.mutedText}>New to JusticeNow? </Text>
          <Pressable
            onPress={() => router.push("/register")}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.linkText}>Create an account</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.divider} />
      </View>

      <PrimaryButton
        title="Continue as anonymous reporter"
        variant="outline"
        icon="◯"
        onPress={() =>
          setInfoMessage(
            "Anonymous reporting will be connected when we implement the case reporting flow."
          )
        }
      />

      {infoMessage ? (
        <View style={styles.privacyWrap}>
          <Notice tone="info" title="Coming soon">
            {infoMessage}
          </Notice>
        </View>
      ) : null}

      <View style={styles.privacyWrap}>
        <Notice tone="privacy">
          Anonymous reports are accepted and investigated. Your name, contact
          details and device information are never attached to the case.
        </Notice>
      </View>

      <Text style={styles.staffText}>
        Signing in as staff? Your role is verified after two-factor
        authentication.{" "}
        <Text
          style={styles.linkText}
          onPress={() => router.push("/secure-role")}
          accessibilityRole="link"
        >
          Staff access
        </Text>
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  brandSection: {
    alignItems: "center",
    paddingTop: 8,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: "#0F1E33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  noticeWrap: {
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.royal[700],
  },
  staffCta: {
    marginTop: 10,
  },
  registerRow: {
    marginTop: 12,
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
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSoft,
  },
  privacyWrap: {
    marginTop: 16,
  },
  staffText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSoft,
  },
});
