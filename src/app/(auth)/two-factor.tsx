import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

export default function TwoFactorScreen() {
  const router = useRouter();

  const [digits, setDigits] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const refs = useRef<(TextInput | null)[]>([]);

  const updateDigit = (
    value: string,
    index: number
  ) => {
    const digit = value.replace(/[^0-9]/g, "");

    const updated = [...digits];
    updated[index] = digit.slice(-1);

    setDigits(updated);

    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    key: string,
    index: number
  ) => {
    if (
      key === "Backspace" &&
      !digits[index] &&
      index > 0
    ) {
      refs.current[index - 1]?.focus();
    }
  };

  const complete =
    digits.every((digit) => digit !== "");

  const verifyCode = () => {
    if (!complete) return;

    // Temporary until Supabase role routing is connected.
    router.replace("/secure-role");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View>
          <Text style={styles.headerTitle}>
            Two-factor authentication
          </Text>

          <Text style={styles.headerSubtitle}>
            Secure account verification
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          <Text style={styles.title}>
            Confirm it&apos;s you
          </Text>

          <Text style={styles.description}>
            Enter the 6-digit security code sent to your
            registered mobile number.
          </Text>

          <Text style={styles.destination}>
            +94 7X XXX 4412
          </Text>

          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  refs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(value) =>
                  updateDigit(value, index)
                }
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(
                    nativeEvent.key,
                    index
                  )
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                accessibilityLabel={`Security code digit ${
                  index + 1
                }`}
                style={[
                  styles.codeInput,
                  digit !== "" &&
                    styles.codeInputFilled,
                ]}
              />
            ))}
          </View>

          <Text style={styles.expiryText}>
            This code expires in{" "}
            <Text style={styles.bold}>
              09:42
            </Text>
          </Text>

          <Pressable
            accessibilityRole="button"
            style={styles.resendButton}
          >
            <Text style={styles.linkText}>
              Send a new code
            </Text>
          </Pressable>
        </View>

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🛡️</Text>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Extra protection for sensitive cases
            </Text>

            <Text style={styles.securityText}>
              Two-factor authentication helps prevent
              unauthorized access to reports, evidence,
              investigation records and administrative
              functions.
            </Text>
          </View>
        </View>

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>
            Having trouble receiving the code?
          </Text>

          <Text style={styles.helpText}>
            Check your mobile connection or request a new
            code. Never share your verification code with
            another person.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          disabled={!complete}
          onPress={verifyCode}
          accessibilityRole="button"
          accessibilityState={{
            disabled: !complete,
          }}
          style={[
            styles.primaryButton,
            !complete && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            Verify and continue
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
    flex: 1,
    padding: 16,
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

  destination: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
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

  expiryText: {
    marginTop: 18,
    fontSize: 12,
    color: colors.textSecondary,
  },

  bold: {
    fontWeight: "700",
    color: colors.navy[800],
  },

  resendButton: {
    padding: 10,
  },

  linkText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.royal[700],
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
  },

  disabledButton: {
    opacity: 0.4,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
});