import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppTextInput,
  AuthScreen,
  CheckboxRow,
  Field,
  Notice,
  PrimaryButton,
  SelectInput,
} from "../../components/common";
import { colors } from "../../theme";
import { reporterLanguages, ReporterLanguageCode } from "./languages";
import { registerReporter } from "./registerReporter";
import {
  hasRegistrationErrors,
  RegistrationErrors,
  validateReporterRegistration,
} from "./validation";

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState<ReporterLanguageCode>("en");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [allowContact, setAllowContact] = useState(true);

  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const clearFieldError = (field: keyof RegistrationErrors) => {
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const handleCreateAccount = async () => {
    setFormError("");
    setSuccessMessage("");

    const nextErrors = validateReporterRegistration({
      fullName,
      email,
      mobile,
      password,
      confirmPassword,
      language,
      acceptTerms,
      allowContact,
    });

    setErrors(nextErrors);

    if (hasRegistrationErrors(nextErrors) || loading) {
      return;
    }

    try {
      setLoading(true);

      const result = await registerReporter({
        fullName,
        email,
        mobile,
        password,
        language,
        allowContact,
      });

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      setSuccessMessage(
        "Account created. Enter the verification code we sent to continue."
      );

      router.push({
        pathname: "/otp",
        params: {
          email: result.email,
        },
      });
    } catch {
      setFormError(
        "We could not create your account. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Step 1 of 2 · Account details"
      onBack={() => router.replace("/login")}
      footer={
        <>
          <PrimaryButton
            title="Create account"
            onPress={handleCreateAccount}
            loading={loading}
          />
          <View style={styles.signInRow}>
            <Text style={styles.mutedText}>Already registered? </Text>
            <Pressable
              onPress={() => router.replace("/login")}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.linkText}>Sign in</Text>
            </Pressable>
          </View>
        </>
      }
    >
      <View style={styles.card}>
        <Field
          label="Full name"
          hint="Used only inside JusticeNow, never shown publicly."
          error={errors.fullName}
        >
          <AppTextInput
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              clearFieldError("fullName");
            }}
            placeholder="e.g. A. Perera"
            autoCapitalize="words"
            autoCorrect={false}
            invalid={Boolean(errors.fullName)}
            accessibilityLabel="Full name"
          />
        </Field>

        <Field label="Email address" error={errors.email}>
          <AppTextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearFieldError("email");
              setFormError("");
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            invalid={Boolean(errors.email)}
            accessibilityLabel="Email address"
          />
        </Field>

        <Field
          label="Mobile number"
          hint="We send a one-time verification code to this number."
          error={errors.mobile}
        >
          <AppTextInput
            value={mobile}
            onChangeText={(value) => {
              setMobile(value);
              clearFieldError("mobile");
            }}
            placeholder="+94 7X XXX XXXX"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            invalid={Boolean(errors.mobile)}
            accessibilityLabel="Mobile number"
          />
        </Field>

        <Field
          label="Password"
          hint="At least 10 characters, including a number."
          error={errors.password}
        >
          <AppTextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearFieldError("password");
              if (confirmPassword) {
                clearFieldError("confirmPassword");
              }
            }}
            placeholder="Create a password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            invalid={Boolean(errors.password)}
            accessibilityLabel="Password"
          />
        </Field>

        <Field
          label="Confirm password"
          error={errors.confirmPassword}
        >
          <AppTextInput
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              clearFieldError("confirmPassword");
            }}
            placeholder="Re-enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            invalid={Boolean(errors.confirmPassword)}
            accessibilityLabel="Confirm password"
          />
        </Field>

        <View style={styles.lastField}>
          <Field label="Preferred language">
            <SelectInput
              value={language}
              options={reporterLanguages.map((item) => ({
                value: item.code,
                label: item.label,
              }))}
              onChange={(value) =>
                setLanguage(value as ReporterLanguageCode)
              }
              accessibilityLabel="Preferred language"
            />
          </Field>
        </View>
      </View>

      <View style={[styles.card, styles.consentCard]}>
        <CheckboxRow
          checked={acceptTerms}
          onPress={() => {
            setAcceptTerms((current) => !current);
            clearFieldError("acceptTerms");
          }}
          label="I accept the privacy policy and terms of use"
          hint="Explains how your report and evidence are stored, who can access them and how long they are kept."
        />
        {errors.acceptTerms ? (
          <Text style={styles.consentError} accessibilityRole="alert">
            {errors.acceptTerms}
          </Text>
        ) : null}

        <CheckboxRow
          checked={allowContact}
          onPress={() => setAllowContact((current) => !current)}
          label="A case officer may contact me about my reports"
          hint="You can change this for each report you submit."
        />
      </View>

      <View style={styles.noticeWrap}>
        <Notice tone="privacy" title="You do not need an account to report">
          An account lets you track cases and receive updates. If you prefer,
          you can still report anonymously from the sign-in screen.
        </Notice>
      </View>

      {formError ? (
        <View style={styles.noticeWrap}>
          <Notice tone="error" title="Unable to create account">
            {formError}
          </Notice>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.noticeWrap}>
          <Notice tone="success" title="Registration successful">
            {successMessage}
          </Notice>
        </View>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
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
  lastField: {
    marginBottom: -14,
  },
  consentCard: {
    marginTop: 16,
  },
  consentError: {
    marginBottom: 4,
    marginLeft: 32,
    fontSize: 12,
    fontWeight: "500",
    color: colors.errorStrong,
  },
  noticeWrap: {
    marginTop: 16,
  },
  signInRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  mutedText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.royal[700],
  },
});
