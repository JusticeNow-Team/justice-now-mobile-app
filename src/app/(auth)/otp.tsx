import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

const OTP_LENGTH = 8;

export default function OtpScreen() {
  const router = useRouter();

  // -------------------------------------------------------
  // Get email from register.tsx
  // -------------------------------------------------------

  const params = useLocalSearchParams<{
    email?: string | string[];
  }>();

  const email = Array.isArray(params.email)
    ? params.email[0]
    : params.email;

  // -------------------------------------------------------
  // State
  // -------------------------------------------------------

  const [digits, setDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill("")
  );

  const [loading, setLoading] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<"error" | "success" | null>(
      null
    );

  const refs =
    useRef<(TextInput | null)[]>([]);

  const complete =
    digits.length === OTP_LENGTH &&
    digits.every(
      (digit) =>
        digit.length === 1 &&
        /^[0-9]$/.test(digit)
    );

  // -------------------------------------------------------
  // Clear status
  // -------------------------------------------------------

  const clearMessage = () => {
    setMessage("");
    setMessageType(null);
  };

  // -------------------------------------------------------
  // Update OTP digit
  // -------------------------------------------------------

  const updateDigit = (
    value: string,
    index: number
  ) => {
    clearMessage();

    const cleaned =
      value.replace(/[^0-9]/g, "");

    // Allow pasting the complete OTP
    if (cleaned.length > 1) {
      const pasted = cleaned
        .slice(0, OTP_LENGTH)
        .split("");

      const next: string[] =
        Array(OTP_LENGTH).fill("");

      pasted.forEach(
        (digit, pastedIndex) => {
          if (
            pastedIndex <
            OTP_LENGTH
          ) {
            next[pastedIndex] =
              digit;
          }
        }
      );

      setDigits(next);

      const nextFocus =
        Math.min(
          pasted.length,
          OTP_LENGTH
        ) - 1;

      if (nextFocus >= 0) {
        refs.current[
          nextFocus
        ]?.focus();
      }

      return;
    }

    const next = [...digits];

    next[index] =
      cleaned.slice(-1);

    setDigits(next);

    if (
      cleaned &&
      index <
        OTP_LENGTH - 1
    ) {
      refs.current[
        index + 1
      ]?.focus();
    }
  };

  // -------------------------------------------------------
  // Backspace navigation
  // -------------------------------------------------------

  const handleKeyPress = (
    key: string,
    index: number
  ) => {
    if (
      key === "Backspace" &&
      digits[index] === "" &&
      index > 0
    ) {
      refs.current[
        index - 1
      ]?.focus();
    }
  };

  // -------------------------------------------------------
  // Verify OTP
  // -------------------------------------------------------

  const verifyCode = async () => {
    console.log(
      "VERIFY BUTTON PRESSED"
    );

    console.log(
      "OTP email:",
      email
    );

    console.log(
      "OTP digits:",
      digits
    );

    console.log(
      "OTP complete:",
      complete
    );

    clearMessage();

    if (!email) {
      setMessageType("error");

      setMessage(
        "The email address is missing. Please return to registration and try again."
      );

      Alert.alert(
        "Email missing",
        "The email address was not passed to the verification screen."
      );

      return;
    }

    if (!complete) {
      setMessageType("error");

      setMessage(
        `Please enter all ${OTP_LENGTH} digits of the verification code.`
      );

      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      const token =
        digits.join("");

      console.log(
        "Sending OTP to Supabase:",
        token
      );

      const {
        data,
        error,
      } =
        await supabase.auth.verifyOtp(
          {
            email:
              email
                .trim()
                .toLowerCase(),

            token,

            type: "email",
          }
        );

      console.log(
        "OTP DATA:",
        data
      );

      console.log(
        "OTP ERROR:",
        error
      );

      if (error) {
        setMessageType("error");

        setMessage(
          error.message
        );

        Alert.alert(
          "Verification failed",
          error.message
        );

        return;
      }

      if (!data.user) {
        setMessageType("error");

        setMessage(
          "Supabase did not return a verified user."
        );

        return;
      }

      console.log(
        "VERIFIED USER:",
        data.user.id
      );

      setMessageType(
        "success"
      );

      setMessage(
        "Your JusticeNow account has been verified successfully."
      );

      Alert.alert(
        "Account verified",
        "Your JusticeNow account has been verified successfully.",
        [
          {
            text: "Continue",

            onPress: async () => {
              try {
                const {
                  error:
                    signOutError,
                } =
                  await supabase.auth.signOut();

                if (
                  signOutError
                ) {
                  console.log(
                    "Sign out error:",
                    signOutError
                  );
                }
              } catch (
                signOutError
              ) {
                console.log(
                  "Sign out error:",
                  signOutError
                );
              }

              router.replace(
                "/login"
              );
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        "Unexpected OTP error:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while verifying the code.";

      setMessageType("error");

      setMessage(
        errorMessage
      );

      Alert.alert(
        "Verification error",
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Resend OTP
  // -------------------------------------------------------

  const resendCode = async () => {
    clearMessage();

    if (!email) {
      setMessageType("error");

      setMessage(
        "Email address is missing."
      );

      return;
    }

    if (resending) {
      return;
    }

    try {
      setResending(true);

      const {
        error,
      } =
        await supabase.auth.resend({
          type: "signup",

          email:
            email
              .trim()
              .toLowerCase(),
        });

      if (error) {
        console.error(
          "OTP resend error:",
          error
        );

        setMessageType("error");

        setMessage(
          error.message
        );

        Alert.alert(
          "Unable to resend code",
          error.message
        );

        return;
      }

      setDigits(
        Array(
          OTP_LENGTH
        ).fill("")
      );

      refs.current[
        0
      ]?.focus();

      setMessageType(
        "success"
      );

      setMessage(
        `A new verification code has been sent to ${email}.`
      );

      Alert.alert(
        "New code sent",
        `A new verification code has been sent to ${email}.`
      );
    } catch (error) {
      console.error(
        "OTP resend error:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Please check your internet connection and try again.";

      setMessageType("error");

      setMessage(
        errorMessage
      );
    } finally {
      setResending(false);
    }
  };

  // -------------------------------------------------------
  // Missing email screen
  // -------------------------------------------------------

  if (!email) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.missingContainer
          }
        >
          <View
            style={
              styles.iconBox
            }
          >
            <Text
              style={
                styles.icon
              }
            >
              ⚠️
            </Text>
          </View>

          <Text
            style={
              styles.title
            }
          >
            Email address
            missing
          </Text>

          <Text
            style={
              styles.description
            }
          >
            JusticeNow could
            not determine which
            account needs
            verification.
            Please return to
            registration and try
            again.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/register"
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Return to registration"
            style={
              styles.returnButton
            }
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              Return to
              registration
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // Main UI
  // -------------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
    >
      {/* Header */}

      <View
        style={styles.header}
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={
            styles.backButton
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerContent
          }
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            Verify your account
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Step 2 of 2 · Email
            confirmation
          </Text>
        </View>
      </View>

      {/* Content */}

      <View
        style={
          styles.content
        }
      >
        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.iconBox
            }
          >
            <Text
              style={
                styles.icon
              }
            >
              ✉️
            </Text>
          </View>

          <Text
            style={
              styles.title
            }
          >
            Enter the 8-digit code
          </Text>

          <Text
            style={
              styles.description
            }
          >
            We sent a verification
            code to{" "}
            <Text
              style={
                styles.bold
              }
            >
              {email}
            </Text>
            . Enter it below to
            activate your
            JusticeNow account.
          </Text>

          {/* OTP inputs */}

          <View
            style={
              styles.codeRow
            }
          >
            {digits.map(
              (
                digit,
                index
              ) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    refs.current[
                      index
                    ] = ref;
                  }}
                  value={
                    digit
                  }
                  onChangeText={(
                    value
                  ) =>
                    updateDigit(
                      value,
                      index
                    )
                  }
                  onKeyPress={({
                    nativeEvent,
                  }) =>
                    handleKeyPress(
                      nativeEvent.key,
                      index
                    )
                  }
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={
                    index === 0
                      ? OTP_LENGTH
                      : 1
                  }
                  selectTextOnFocus
                  autoCorrect={false}
                  accessibilityLabel={`Verification code digit ${
                    index + 1
                  }`}
                  style={[
                    styles.codeInput,

                    digit !== "" &&
                      styles.codeInputFilled,
                  ]}
                />
              )
            )}
          </View>

          {/* Inline status */}

          {message !== "" && (
            <View
              style={[
                styles.messageBox,

                messageType ===
                  "error"
                  ? styles.errorBox
                  : styles.successBox,
              ]}
            >
              <Text
                style={[
                  styles.messageText,

                  messageType ===
                    "error"
                    ? styles.errorText
                    : styles.successText,
                ]}
              >
                {message}
              </Text>
            </View>
          )}

          {/* Resend */}

          <Text
            style={
              styles.resendText
            }
          >
            Did not receive the
            code?
          </Text>

          <Pressable
            onPress={
              resendCode
            }
            disabled={
              resending
            }
            accessibilityRole="button"
            accessibilityLabel="Send verification code again"
            accessibilityState={{
              disabled:
                resending,
            }}
            style={
              styles.resendButton
            }
          >
            {resending ? (
              <ActivityIndicator
                size="small"
                color={
                  colors
                    .royal[700]
                }
              />
            ) : (
              <Text
                style={
                  styles.linkText
                }
              >
                Send the code
                again
              </Text>
            )}
          </Pressable>
        </View>

        {/* Security warning */}

        <View
          style={
            styles.warning
          }
        >
          <Text
            style={
              styles.warningIcon
            }
          >
            ⚠️
          </Text>

          <View
            style={
              styles.warningContent
            }
          >
            <Text
              style={
                styles.warningTitle
              }
            >
              Keep this code
              private
            </Text>

            <Text
              style={
                styles.warningText
              }
            >
              JusticeNow staff
              will never ask you
              for this
              verification code
              by phone, email or
              message.
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}

      <View
        style={
          styles.footer
        }
      >
        <Pressable
          // Only disable during the actual request.
          // If OTP is incomplete, verifyCode()
          // now shows a visible error.
          disabled={loading}
          onPress={
            verifyCode
          }
          accessibilityRole="button"
          accessibilityLabel="Verify and continue"
          accessibilityState={{
            disabled:
              loading,
          }}
          style={[
            styles.primaryButton,

            (!complete ||
              loading) &&
              styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator
              color={
                colors
                  .textInverse
              }
            />
          ) : (
            <Text
              style={
                styles.primaryText
              }
            >
              Verify and
              continue
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    header: {
      minHeight: 66,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 14,

      borderBottomWidth: 1,
      borderBottomColor:
        colors.border,

      backgroundColor:
        colors.surface,
    },

    backButton: {
      width: 42,
      height: 42,

      alignItems: "center",
      justifyContent: "center",
    },

    backText: {
      fontSize: 32,

      color:
        colors.navy[700],
    },

    headerContent: {
      flex: 1,
    },

    headerTitle: {
      fontSize: 17,
      fontWeight: "700",

      color:
        colors.navy[800],
    },

    headerSubtitle: {
      marginTop: 2,

      fontSize: 11.5,

      color:
        colors.textSecondary,
    },

    content: {
      flex: 1,

      padding: 16,
    },

    card: {
      alignItems: "center",

      padding: 20,

      borderWidth: 1,
      borderColor:
        colors.border,

      borderRadius: 16,

      backgroundColor:
        colors.surface,
    },

    iconBox: {
      width: 56,
      height: 56,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 16,

      backgroundColor:
        colors.royal[50],
    },

    icon: {
      fontSize: 24,
    },

    title: {
      marginTop: 12,

      textAlign: "center",

      fontSize: 17,
      fontWeight: "700",

      color:
        colors.navy[800],
    },

    description: {
      marginTop: 6,

      textAlign: "center",

      fontSize: 13,
      lineHeight: 19,

      color:
        colors.textSecondary,
    },

    bold: {
      fontWeight: "700",

      color:
        colors.navy[800],
    },

    codeRow: {
      width: "100%",

      flexDirection: "row",

      justifyContent: "center",

      gap: 4,

      marginTop: 22,
    },

    codeInput: {
      flex: 1,

      maxWidth: 36,

      height: 52,

      paddingHorizontal: 0,

      textAlign: "center",

      borderWidth: 1,

      borderColor:
        colors.navy[200],

      borderRadius: 9,

      fontSize: 18,
      fontWeight: "700",

      color:
        colors.navy[800],

      backgroundColor:
        colors.surface,
    },

    codeInputFilled: {
      borderColor:
        colors.royal[400],

      backgroundColor:
        colors.royal[50],
    },

    messageBox: {
      width: "100%",

      marginTop: 16,

      padding: 11,

      borderWidth: 1,
      borderRadius: 10,
    },

    errorBox: {
      borderColor:
        colors.error,

      backgroundColor:
        "#FFF2F1",
    },

    successBox: {
      borderColor:
        colors.success,

      backgroundColor:
        "#EFFAF5",
    },

    messageText: {
      textAlign: "center",

      fontSize: 12,
      lineHeight: 17,
    },

    errorText: {
      color:
        colors.error,
    },

    successText: {
      color:
        colors.success,
    },

    resendText: {
      marginTop: 18,

      fontSize: 12,

      color:
        colors.textSecondary,
    },

    resendButton: {
      minHeight: 40,

      paddingHorizontal: 12,

      alignItems: "center",
      justifyContent: "center",
    },

    linkText: {
      fontSize: 12.5,
      fontWeight: "600",

      color:
        colors.royal[700],
    },

    warning: {
      flexDirection: "row",

      marginTop: 14,

      padding: 14,

      borderWidth: 1,

      borderColor:
        "#F1D79B",

      borderRadius: 14,

      backgroundColor:
        colors.gold[50],
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

      color:
        colors.warning,
    },

    warningText: {
      marginTop: 3,

      fontSize: 11.5,
      lineHeight: 17,

      color:
        colors.textSecondary,
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

      justifyContent: "center",
      alignItems: "center",

      borderRadius: 12,

      backgroundColor:
        colors.royal[700],
    },

    disabled: {
      opacity: 0.4,
    },

    primaryText: {
      fontSize: 15,
      fontWeight: "700",

      color:
        colors.textInverse,
    },

    missingContainer: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      padding: 30,
    },

    returnButton: {
      minHeight: 48,

      marginTop: 24,

      paddingHorizontal: 24,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 12,

      backgroundColor:
        colors.royal[700],
    },

    returnButtonText: {
      fontSize: 14,
      fontWeight: "700",

      color:
        colors.textInverse,
    },
  });