import { useLocalSearchParams } from "expo-router";
import {
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";

import { colors } from "../../../theme";

export default function OnboardingScreen() {
  const { step } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        Onboarding Step {step}
      </Text>

      <Text style={styles.text}>
        JusticeNow onboarding will be implemented next.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.background,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.navy[800],
  },

  text: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
});