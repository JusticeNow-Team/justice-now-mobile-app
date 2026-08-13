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

export default function OtpScreen() {
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

    const next = [...digits];
    next[index] = digit.slice(-1);

    setDigits(next);

    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const complete =
    digits.every((digit) => digit !== "");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View>
          <Text style={styles.headerTitle}>
            Verify your number
          </Text>

          <Text style={styles.headerSubtitle}>
            Step 2 of 2 · Confirmation
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>💬</Text>
          </View>

          <Text style={styles.title}>
            Enter the 6-digit code
          </Text>

          <Text style={styles.description}>
            We sent a code to{" "}
            <Text style={styles.bold}>
              +94 7X XXX 4412
            </Text>
            . It is valid for 10 minutes.
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
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                style={[
                  styles.codeInput,
                  digit !== "" &&
                    styles.codeInputFilled,
                ]}
              />
            ))}
          </View>

          <Text style={styles.resendText}>
            Did not receive it?{" "}
            <Text style={styles.bold}>
              Resend in 00:42
            </Text>
          </Text>

          <Pressable style={styles.resendButton}>
            <Text style={styles.linkText}>
              Send the code again
            </Text>
          </Pressable>
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningIcon}>⚠️</Text>

          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              Keep this code private
            </Text>

            <Text style={styles.warningText}>
              JusticeNow staff will never ask you for this
              code by phone or message.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          disabled={!complete}
          onPress={() => router.replace("/login")}
          style={[
            styles.primaryButton,
            !complete && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>
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
    width: 56,
    height: 56,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 16,

    backgroundColor: colors.royal[50],
  },

  icon: {
    fontSize: 24,
  },

  title: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },

  description: {
    marginTop: 5,

    textAlign: "center",

    fontSize: 13,
    lineHeight: 19,

    color: colors.textSecondary,
  },

  bold: {
    fontWeight: "700",
    color: colors.navy[800],
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

  resendText: {
    marginTop: 18,
    fontSize: 12,
    color: colors.textSecondary,
  },

  resendButton: {
    padding: 10,
  },

  linkText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.royal[700],
  },

  warning: {
    flexDirection: "row",
    marginTop: 14,

    padding: 14,

    borderWidth: 1,
    borderColor: "#F1D79B",
    borderRadius: 14,

    backgroundColor: colors.gold[50],
  },

  warningIcon: {
    marginRight: 8,
  },

  warningContent: {
    flex: 1,
  },

  warningTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.warning,
  },

  warningText: {
    marginTop: 3,
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

    justifyContent: "center",
    alignItems: "center",

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