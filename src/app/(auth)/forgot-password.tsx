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

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [recoveryValue, setRecoveryValue] =
    useState("");
  const [method, setMethod] =
    useState<"email" | "sms">("email");

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Reset your password
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🔑</Text>
            </View>

            <Text style={styles.title}>
              We will help you get back in
            </Text>

            <Text style={styles.description}>
              Enter the email or mobile number linked to
              your account. Your cases and evidence stay
              secure while you reset.
            </Text>

            <Text style={styles.label}>
              Email or mobile number
            </Text>

            <TextInput
              value={recoveryValue}
              onChangeText={setRecoveryValue}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSoft}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <Text style={styles.sectionTitle}>
            Where should we send the reset link?
          </Text>

          <ChoiceCard
            selected={method === "email"}
            title="Email"
            description="a•••••a@example.org"
            onPress={() => setMethod("email")}
          />

          <ChoiceCard
            selected={method === "sms"}
            title="SMS"
            description="+94 7X XXX 4412"
            onPress={() => setMethod("sms")}
          />

          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>🔒</Text>

            <Text style={styles.noticeText}>
              For your safety, the reset link expires after
              15 minutes and can be used once.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() =>
              router.push("/reset-password")
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>
              Send reset link
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  onPress,
}: {
  selected: boolean;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.choiceCard,
        selected && styles.choiceCardSelected,
      ]}
    >
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>
          {title}
        </Text>

        <Text style={styles.choiceDescription}>
          {description}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          selected && styles.radioSelected,
        ]}
      >
        {selected && <View style={styles.radioDot} />}
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
  },

  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.royal[50],
  },

  icon: {
    fontSize: 21,
  },

  title: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },

  description: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  label: {
    marginTop: 18,
    marginBottom: 6,

    fontSize: 13,
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

  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,

    fontSize: 13,
    fontWeight: "600",

    color: colors.navy[800],
  },

  choiceCard: {
    minHeight: 68,

    flexDirection: "row",
    alignItems: "center",

    marginBottom: 9,
    paddingHorizontal: 14,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  choiceCardSelected: {
    borderColor: colors.royal[500],
    backgroundColor: colors.royal[50],
  },

  choiceText: {
    flex: 1,
  },

  choiceTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },

  choiceDescription: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 2,
    borderColor: colors.navy[300],
  },

  radioSelected: {
    borderColor: colors.royal[700],
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.royal[700],
  },

  notice: {
    marginTop: 10,
    flexDirection: "row",

    padding: 14,

    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,

    backgroundColor: colors.teal[50],
  },

  noticeIcon: {
    marginRight: 8,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
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

  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
});