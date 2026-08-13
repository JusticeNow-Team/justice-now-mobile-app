import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

export default function ForgotPasswordScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        Forgot Password
      </Text>

      <Text style={styles.text}>
        This screen will be implemented next.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.navy[800],
  },

  text: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
});