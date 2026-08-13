import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Create a new password
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>
            New password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter a new password"
            placeholderTextColor={colors.textSoft}
            style={styles.input}
          />

          <Text style={styles.label}>
            Confirm new password
          </Text>

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Re-enter the new password"
            placeholderTextColor={colors.textSoft}
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
        </View>

        <Text style={styles.helpText}>
          After saving, you will be signed out of all
          other devices. Any open drafts remain saved on
          your account.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          disabled={!valid}
          onPress={() => router.replace("/login")}
          style={[
            styles.primaryButton,
            !valid && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>
            Save new password
          </Text>
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
    flex: 1,
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

  helpText: {
    marginTop: 16,
    paddingHorizontal: 3,

    fontSize: 12.5,
    lineHeight: 18,

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