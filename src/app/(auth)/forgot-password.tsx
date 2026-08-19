import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSendResetLink = async () => {
    if (loading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const redirectTo = Linking.createURL("reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "If an account exists for this email, a secure password-recovery link has been sent. Check your inbox and spam folder.",
      );
    } catch (error) {
      console.error("Password recovery request failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to send the recovery email. Please try again.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
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
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Reset your password</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🔑</Text>
            </View>

            <Text style={styles.title}>We will help you get back in</Text>

            <Text style={styles.description}>
              Enter the email linked to your account. Your cases and evidence
              stay secure while you reset your password.
            </Text>

            <Text style={styles.label}>Email address</Text>

            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSoft}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
              onSubmitEditing={handleSendResetLink}
              returnKeyType="send"
              style={styles.input}
            />

            {errorMessage !== "" && (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {successMessage !== "" && (
              <View style={styles.successBox} accessibilityRole="alert">
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}
          </View>

          <View style={styles.deliveryCard}>
            <View style={styles.deliveryIconBox}>
              <Text style={styles.deliveryIcon}>✉</Text>
            </View>

            <View style={styles.deliveryText}>
              <Text style={styles.deliveryTitle}>Recovery by email</Text>

              <Text style={styles.deliveryDescription}>
                Open the link in the email on this device to create your new
                password.
              </Text>
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>🔒</Text>

            <Text style={styles.noticeText}>
              For your safety, recovery links expire and cannot be reused after
              the password is changed.
            </Text>
          </View>

          <Pressable
            onPress={() => router.replace("/login")}
            style={styles.signInLink}
            accessibilityRole="button"
          >
            <Text style={styles.signInLinkText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSendResetLink}
            disabled={loading}
            style={[styles.primaryButton, loading && styles.disabled]}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryText}>
                {successMessage ? "Send another link" : "Send reset link"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingBottom: 28,
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

  errorBox: {
    marginTop: 12,
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

  successBox: {
    marginTop: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.teal[200],
    borderRadius: 10,
    backgroundColor: colors.teal[50],
  },

  successText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.success,
  },

  deliveryCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.royal[300],
    borderRadius: 14,
    backgroundColor: colors.royal[50],
  },

  deliveryIconBox: {
    width: 36,
    height: 36,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  deliveryIcon: {
    fontSize: 18,
    color: colors.royal[700],
  },

  deliveryText: {
    flex: 1,
    paddingVertical: 12,
  },

  deliveryTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },

  deliveryDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
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

  signInLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  signInLinkText: {
    fontSize: 13,
    fontWeight: "600",
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
    opacity: 0.6,
  },

  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
