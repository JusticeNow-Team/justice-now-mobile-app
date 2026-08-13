import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSignIn = () => {
    // Temporary navigation.
    // Supabase authentication will be connected later.
    router.navigate("/two-factor");
  };

  const handleAnonymous = () => {
    Alert.alert(
      "Anonymous reporting",
      "The anonymous reporter flow will be connected when we implement the Reporter module."
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
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

          {/* Login Card */}
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Email or username
              </Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSoft}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email or username"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel="Password"
                style={styles.input}
              />
            </View>

            <View style={styles.optionsRow}>
              <Pressable
                onPress={() =>
                  setRememberMe((current) => !current)
                }
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: rememberMe,
                }}
                style={styles.rememberRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>

                <Text style={styles.rememberText}>
                  Remember me
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.navigate("/forgot-password")
                }
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleSignIn}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.signInText}>
                Sign in
              </Text>
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={styles.mutedText}>
                New to JusticeNow?{" "}
              </Text>

              <Pressable
                onPress={() =>
                  router.navigate("/register")
                }
              >
                <Text style={styles.linkText}>
                  Create an account
                </Text>
              </Pressable>
            </View>
          </View>

          {/* OR divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />

            <Text style={styles.orText}>OR</Text>

            <View style={styles.divider} />
          </View>

          {/* Anonymous reporting */}
          <Pressable
            onPress={handleAnonymous}
            accessibilityRole="button"
            accessibilityLabel="Continue as anonymous reporter"
            style={({ pressed }) => [
              styles.anonymousButton,
              pressed && styles.anonymousPressed,
            ]}
          >
            <Text style={styles.anonymousIcon}>◯</Text>

            <Text style={styles.anonymousText}>
              Continue as anonymous reporter
            </Text>
          </Pressable>

          {/* Privacy notice */}
          <View style={styles.privacyNotice}>
            <Text style={styles.lockIcon}>🔒</Text>

            <Text style={styles.privacyText}>
              Anonymous reports are accepted and
              investigated. Your name, contact details and
              device information are never attached to the
              case.
            </Text>
          </View>

          {/* Staff access */}
          <View style={styles.staffSection}>
            <Text style={styles.staffText}>
              Signing in as staff? Your role is verified
              after two-factor authentication.{" "}
            </Text>

            <Pressable
              onPress={() =>
                router.navigate("/secure-role")
              }
            >
              <Text style={styles.linkText}>
                Staff access
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },

  brandSection: {
    alignItems: "center",
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,

    elevation: 2,
  },

  fieldGroup: {
    marginBottom: 14,
  },

  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    backgroundColor: colors.surface,

    paddingHorizontal: 14,
    paddingVertical: 12,

    fontSize: 14,
    color: colors.navy[800],
  },

  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
  },

  checkbox: {
    width: 20,
    height: 20,
    marginRight: 8,

    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.navy[300],

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.surface,
  },

  checkboxChecked: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },

  checkmark: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: "700",
  },

  rememberText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy[800],
  },

  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.royal[700],
  },

  signInButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },

  buttonPressed: {
    backgroundColor: colors.royal[800],
  },

  signInText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: "600",
  },

  registerRow: {
    marginTop: 14,
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
    color: colors.textSoft,
  },

  anonymousButton: {
    minHeight: 48,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,

    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],

    backgroundColor: colors.surface,
  },

  anonymousPressed: {
    backgroundColor: colors.navy[50],
  },

  anonymousIcon: {
    fontSize: 16,
    color: colors.navy[700],
  },

  anonymousText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[700],
  },

  privacyNotice: {
    marginTop: 16,

    flexDirection: "row",
    alignItems: "flex-start",

    padding: 14,

    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.teal[100],

    backgroundColor: colors.teal[50],
  },

  lockIcon: {
    marginRight: 9,
    fontSize: 14,
  },

  privacyText: {
    flex: 1,

    fontSize: 12,
    lineHeight: 18,

    color: colors.teal[800],
  },

  staffSection: {
    marginTop: 18,

    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",

    paddingHorizontal: 10,
  },

  staffText: {
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSoft,
  },
});