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

const languages = [
  {
    code: "en",
    label: "English",
  },
  {
    code: "si",
    label: "සිංහල",
  },
  {
    code: "ta",
    label: "தமிழ்",
  },
];

export default function RegisterScreen() {
  const router = useRouter();

  // -------------------------------------------------------
  // Form state
  // -------------------------------------------------------

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [language, setLanguage] = useState("en");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [allowContact, setAllowContact] = useState(true);

  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------
  // Validation
  // -------------------------------------------------------

  const cleanEmail = email.trim().toLowerCase();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    cleanEmail
  );

  const passwordLongEnough = password.length >= 10;

  const passwordHasNumber = /\d/.test(password);

  const passwordHasUppercase = /[A-Z]/.test(password);

  const passwordsMatch =
    password.length > 0 &&
    password === confirmPassword;

  const passwordMismatch =
    confirmPassword.length > 0 &&
    !passwordsMatch;

  // Phone is required only when user allows contact
  const mobileValid =
    !allowContact ||
    mobile.trim() !== "";

  const canContinue =
    fullName.trim() !== "" &&
    emailValid &&
    mobileValid &&
    passwordLongEnough &&
    passwordHasNumber &&
    passwordHasUppercase &&
    passwordsMatch &&
    acceptTerms;

  // -------------------------------------------------------
  // Supabase Registration
  // -------------------------------------------------------

  const handleCreateAccount = async () => {
    if (!canContinue || loading) {
      return;
    }

    try {
      setLoading(true);

      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,

          options: {
            data: {
              full_name: fullName.trim(),

              phone:
                mobile.trim() !== ""
                  ? mobile.trim()
                  : null,

              preferred_language: language,

              allow_case_contact: allowContact,
            },
          },
        });

      if (error) {
        console.error(
          "Supabase signup error:",
          error
        );

        Alert.alert(
          "Unable to create account",
          error.message
        );

        return;
      }

      if (!data.user) {
        Alert.alert(
          "Account creation failed",
          "JusticeNow could not create your account. Please try again."
        );

        return;
      }

      // ---------------------------------------------------
      // Email verification is enabled.
      // Supabase/Brevo sends a 6-digit OTP.
      // ---------------------------------------------------

      router.push({
        pathname: "/otp",
        params: {
          email: cleanEmail,
        },
      });
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      Alert.alert(
        "Connection error",
        "We could not create your account. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        {/* Header */}

        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              Create your account
            </Text>

            <Text style={styles.headerSubtitle}>
              Step 1 of 2 · Account details
            </Text>
          </View>
        </View>

        {/* Form */}

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Account Details */}

          <View style={styles.card}>
            {/* Full Name */}

            <FieldLabel
              label="Full name"
              hint="Used only inside JusticeNow, never shown publicly."
            />

            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. A. Perera"
              placeholderTextColor={
                colors.textSoft
              }
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Full name"
            />

            {/* Email */}

            <FieldLabel
              label="Email address"
              hint="We will send your 6-digit account verification code here."
            />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={
                colors.textSoft
              }
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,

                email.length > 0 &&
                  !emailValid &&
                  styles.inputError,
              ]}
              accessibilityLabel="Email address"
            />

            {email.length > 0 &&
              !emailValid && (
                <Text
                  style={styles.errorText}
                  accessibilityRole="alert"
                >
                  Enter a valid email address.
                </Text>
              )}

            {/* Mobile */}

            <FieldLabel
              label={
                allowContact
                  ? "Mobile number"
                  : "Mobile number (optional)"
              }
              hint={
                allowContact
                  ? "Used only if JusticeNow needs to contact you about your cases."
                  : "You have disabled case contact, so providing a mobile number is optional."
              }
            />

            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="+94 7X XXX XXXX"
              placeholderTextColor={
                colors.textSoft
              }
              keyboardType="phone-pad"
              style={[
                styles.input,

                allowContact &&
                  mobile.length > 0 &&
                  mobile.trim() === "" &&
                  styles.inputError,
              ]}
              accessibilityLabel="Mobile number"
            />

            {/* Password */}

            <FieldLabel
              label="Password"
              hint="Use at least 10 characters, including an uppercase letter and a number."
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor={
                colors.textSoft
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Password"
            />

            {password.length > 0 && (
              <View
                style={styles.passwordRules}
              >
                <PasswordRule
                  met={passwordLongEnough}
                  text="At least 10 characters"
                />

                <PasswordRule
                  met={passwordHasUppercase}
                  text="Contains an uppercase letter"
                />

                <PasswordRule
                  met={passwordHasNumber}
                  text="Contains a number"
                />
              </View>
            )}

            {/* Confirm Password */}

            <FieldLabel
              label="Confirm password"
            />

            <TextInput
              value={confirmPassword}
              onChangeText={
                setConfirmPassword
              }
              placeholder="Re-enter your password"
              placeholderTextColor={
                colors.textSoft
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,

                passwordMismatch &&
                  styles.inputError,
              ]}
              accessibilityLabel="Confirm password"
            />

            {passwordMismatch && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
              >
                Passwords do not match.
              </Text>
            )}

            {/* Preferred Language */}

            <FieldLabel
              label="Preferred language"
            />

            <View style={styles.languageRow}>
              {languages.map((item) => {
                const selected =
                  language === item.code;

                return (
                  <Pressable
                    key={item.code}
                    onPress={() =>
                      setLanguage(item.code)
                    }
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected,
                    }}
                    accessibilityLabel={
                      item.label
                    }
                    style={[
                      styles.languageButton,

                      selected &&
                        styles.languageButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.languageText,

                        selected &&
                          styles.languageTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Privacy and Consent */}

          <View style={styles.card}>
            <CheckboxRow
              checked={acceptTerms}
              onPress={() =>
                setAcceptTerms(
                  (value) => !value
                )
              }
              label="I accept the privacy policy and terms of use"
              hint="Explains how your report and evidence are stored, who can access them and how long they are kept."
            />

            <View
              style={styles.checkboxDivider}
            />

            <CheckboxRow
              checked={allowContact}
              onPress={() =>
                setAllowContact(
                  (value) => !value
                )
              }
              label="A case officer may contact me about my reports"
              hint="You can change this preference later for individual cases."
            />
          </View>

          {/* Anonymous Reporting Notice */}

          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>
              🔒
            </Text>

            <View
              style={styles.noticeContent}
            >
              <Text
                style={styles.noticeTitle}
              >
                You do not need an account
                to report
              </Text>

              <Text
                style={styles.noticeText}
              >
                An account lets you track
                cases and receive updates.
                If you prefer, you can
                still report anonymously
                from the sign-in screen.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}

        <View style={styles.footer}>
          <Pressable
            disabled={
              !canContinue || loading
            }
            onPress={handleCreateAccount}
            accessibilityRole="button"
            accessibilityState={{
              disabled:
                !canContinue || loading,
            }}
            accessibilityLabel="Create account"
            style={[
              styles.primaryButton,

              (!canContinue || loading) &&
                styles.disabledButton,
            ]}
          >
            {loading ? (
              <ActivityIndicator
                color={colors.textInverse}
              />
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Create account
              </Text>
            )}
          </Pressable>

          <View style={styles.signInRow}>
            <Text
              style={styles.mutedText}
            >
              Already registered?{" "}
            </Text>

            <Pressable
              onPress={() =>
                router.replace("/login")
              }
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text
                style={styles.linkText}
              >
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Field Label
// ---------------------------------------------------------

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <View
      style={styles.fieldLabelContainer}
    >
      <Text style={styles.label}>
        {label}
      </Text>

      {hint && (
        <Text style={styles.hint}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------
// Checkbox Row
// ---------------------------------------------------------

function CheckboxRow({
  checked,
  onPress,
  label,
  hint,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  hint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked,
      }}
      style={styles.checkboxRow}
    >
      <View
        style={[
          styles.checkbox,

          checked &&
            styles.checkboxChecked,
        ]}
      >
        {checked && (
          <Text
            style={styles.checkmark}
          >
            ✓
          </Text>
        )}
      </View>

      <View
        style={styles.checkboxContent}
      >
        <Text
          style={styles.checkboxLabel}
        >
          {label}
        </Text>

        <Text
          style={styles.checkboxHint}
        >
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------
// Password Rule
// ---------------------------------------------------------

function PasswordRule({
  met,
  text,
}: {
  met: boolean;
  text: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <Text
        style={[
          styles.ruleIcon,

          met && styles.ruleIconMet,
        ]}
      >
        ✓
      </Text>

      <Text
        style={[
          styles.ruleText,

          met && styles.ruleTextMet,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  flex: {
    flex: 1,
  },

  header: {
    minHeight: 66,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 14,

    backgroundColor:
      colors.surface,

    borderBottomWidth: 1,
    borderBottomColor:
      colors.border,
  },

  backButton: {
    width: 42,
    height: 42,

    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    fontSize: 32,
    color: colors.navy[700],
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",

    color: colors.navy[800],
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color:
      colors.textSecondary,
  },

  content: {
    padding: 16,
    gap: 14,
  },

  card: {
    padding: 16,

    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,

    backgroundColor:
      colors.surface,
  },

  fieldLabelContainer: {
    marginTop: 4,
    marginBottom: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",

    color: colors.navy[800],
  },

  hint: {
    marginTop: 3,

    fontSize: 11,
    lineHeight: 16,

    color:
      colors.textSecondary,
  },

  input: {
    minHeight: 48,

    marginBottom: 12,
    paddingHorizontal: 14,

    borderWidth: 1,
    borderColor:
      colors.navy[200],
    borderRadius: 12,

    fontSize: 14,

    color: colors.navy[800],

    backgroundColor:
      colors.surface,
  },

  inputError: {
    borderColor: colors.error,
  },

  errorText: {
    marginTop: -6,
    marginBottom: 10,

    fontSize: 11.5,

    color: colors.error,
  },

  passwordRules: {
    gap: 6,

    marginTop: -5,
    marginBottom: 12,
  },

  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  ruleIcon: {
    width: 20,

    fontSize: 12,
    fontWeight: "700",

    color: colors.navy[200],
  },

  ruleIconMet: {
    color: colors.success,
  },

  ruleText: {
    fontSize: 11.5,

    color:
      colors.textSecondary,
  },

  ruleTextMet: {
    color: colors.success,
  },

  languageRow: {
    flexDirection: "row",
    gap: 8,

    marginTop: 2,
  },

  languageButton: {
    flex: 1,
    minHeight: 42,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,

    backgroundColor:
      colors.surface,
  },

  languageButtonSelected: {
    borderColor:
      colors.royal[600],

    backgroundColor:
      colors.royal[50],
  },

  languageText: {
    fontSize: 12,
    fontWeight: "600",

    color:
      colors.textSecondary,
  },

  languageTextSelected: {
    color: colors.royal[700],
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  checkbox: {
    width: 21,
    height: 21,

    marginRight: 10,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1.5,
    borderColor:
      colors.navy[300],
    borderRadius: 5,
  },

  checkboxChecked: {
    backgroundColor:
      colors.royal[700],

    borderColor:
      colors.royal[700],
  },

  checkmark: {
    fontSize: 13,
    fontWeight: "700",

    color:
      colors.textInverse,
  },

  checkboxContent: {
    flex: 1,
  },

  checkboxLabel: {
    fontSize: 13,
    fontWeight: "600",

    color: colors.navy[800],
  },

  checkboxHint: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 17,

    color:
      colors.textSecondary,
  },

  checkboxDivider: {
    height: 1,

    marginVertical: 14,

    backgroundColor:
      colors.border,
  },

  notice: {
    flexDirection: "row",

    padding: 14,

    borderWidth: 1,
    borderColor:
      colors.teal[100],
    borderRadius: 14,

    backgroundColor:
      colors.teal[50],
  },

  noticeIcon: {
    marginRight: 10,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 12.5,
    fontWeight: "700",

    color:
      colors.teal[800],
  },

  noticeText: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 17,

    color:
      colors.teal[800],
  },

  footer: {
    padding: 14,

    borderTopWidth: 1,
    borderTopColor:
      colors.border,

    backgroundColor:
      colors.surface,
  },

  primaryButton: {
    minHeight: 50,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor:
      colors.royal[700],
  },

  disabledButton: {
    opacity: 0.45,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",

    color:
      colors.textInverse,
  },

  signInRow: {
    flexDirection: "row",
    justifyContent: "center",

    marginTop: 9,
  },

  mutedText: {
    fontSize: 12,

    color:
      colors.textSecondary,
  },

  linkText: {
    fontSize: 12,
    fontWeight: "700",

    color:
      colors.royal[700],
  },
});