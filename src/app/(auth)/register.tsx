import { useRouter } from "expo-router";
import { useState } from "react";
import {
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

import { colors } from "../../theme";

const languages = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState("en");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [allowContact, setAllowContact] = useState(true);

  const passwordMismatch =
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  const canContinue =
    fullName.trim() !== "" &&
    email.trim() !== "" &&
    mobile.trim() !== "" &&
    password.length >= 10 &&
    !passwordMismatch &&
    acceptTerms;

  const handleCreateAccount = () => {
    if (!canContinue) return;

    router.push("/otp");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
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

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              Create your account
            </Text>

            <Text style={styles.headerSubtitle}>
              Step 1 of 2 · Account details
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <FieldLabel
              label="Full name"
              hint="Used only inside JusticeNow, never shown publicly."
            />

            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. A. Perera"
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              accessibilityLabel="Full name"
            />

            <FieldLabel label="Email address" />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSoft}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              accessibilityLabel="Email address"
            />

            <FieldLabel
              label="Mobile number"
              hint="We send a one-time verification code to this number."
            />

            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="+94 7X XXX XXXX"
              placeholderTextColor={colors.textSoft}
              keyboardType="phone-pad"
              style={styles.input}
              accessibilityLabel="Mobile number"
            />

            <FieldLabel
              label="Password"
              hint="At least 10 characters, including a number."
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor={colors.textSoft}
              secureTextEntry
              style={styles.input}
              accessibilityLabel="Password"
            />

            <FieldLabel label="Confirm password" />

            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textSoft}
              secureTextEntry
              style={[
                styles.input,
                passwordMismatch && styles.inputError,
              ]}
              accessibilityLabel="Confirm password"
            />

            {passwordMismatch && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
              >
                Passwords do not match yet.
              </Text>
            )}

            <FieldLabel label="Preferred language" />

            <View style={styles.languageRow}>
              {languages.map((item) => {
                const selected = language === item.code;

                return (
                  <Pressable
                    key={item.code}
                    onPress={() => setLanguage(item.code)}
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

          <View style={styles.card}>
            <CheckboxRow
              checked={acceptTerms}
              onPress={() =>
                setAcceptTerms((value) => !value)
              }
              label="I accept the privacy policy and terms of use"
              hint="Explains how your report and evidence are stored, who can access them and how long they are kept."
            />

            <View style={styles.checkboxDivider} />

            <CheckboxRow
              checked={allowContact}
              onPress={() =>
                setAllowContact((value) => !value)
              }
              label="A case officer may contact me about my reports"
              hint="You can change this for each report you submit."
            />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>🔒</Text>

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                You do not need an account to report
              </Text>

              <Text style={styles.noticeText}>
                An account lets you track cases and receive
                updates. If you prefer, you can still report
                anonymously from the sign-in screen.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            disabled={!canContinue}
            onPress={handleCreateAccount}
            style={[
              styles.primaryButton,
              !canContinue && styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              Create account
            </Text>
          </Pressable>

          <View style={styles.signInRow}>
            <Text style={styles.mutedText}>
              Already registered?{" "}
            </Text>

            <Pressable
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.linkText}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <View style={styles.fieldLabelContainer}>
      <Text style={styles.label}>{label}</Text>

      {hint && (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

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
      accessibilityState={{ checked }}
      style={styles.checkboxRow}
    >
      <View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
        ]}
      >
        {checked && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>

      <View style={styles.checkboxContent}>
        <Text style={styles.checkboxLabel}>
          {label}
        </Text>

        <Text style={styles.checkboxHint}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flex: {
    flex: 1,
  },

  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
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
    color: colors.textSecondary,
  },

  input: {
    minHeight: 48,
    marginBottom: 12,
    paddingHorizontal: 14,

    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,

    fontSize: 14,
    color: colors.navy[800],

    backgroundColor: colors.surface,
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

    backgroundColor: colors.surface,
  },

  languageButtonSelected: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },

  languageText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
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
    borderColor: colors.navy[300],
    borderRadius: 5,
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
    color: colors.textSecondary,
  },

  checkboxDivider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: colors.border,
  },

  notice: {
    flexDirection: "row",
    padding: 14,

    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,

    backgroundColor: colors.teal[50],
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
    color: colors.teal[800],
  },

  noticeText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.teal[800],
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

  disabledButton: {
    opacity: 0.45,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },

  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 9,
  },

  mutedText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  linkText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.royal[700],
  },
});