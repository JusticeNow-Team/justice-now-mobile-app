import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../theme";

export default function SplashScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <Image
          source={require("../../assets/images/justicenow-logo-mark.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="JusticeNow logo"
        />

        <Text style={styles.brand}>
          Justice<Text style={styles.brandAccent}>Now</Text>
        </Text>

        <Text style={styles.tagline}>
          Report Safely. Track Transparently.
          {"\n"}
          Seek Justice.
        </Text>

        <View
          style={styles.loadingContainer}
          accessibilityRole="progressbar"
          accessibilityLabel="Establishing a secure connection"
        >
          <View style={styles.loadingTrack}>
            <View style={styles.loadingProgress} />
          </View>

          <Text style={styles.loadingText}>
            🔒 Establishing a secure connection…
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.sdgText}>
          Supporting SDG 16 · Peace, Justice and Strong Institutions
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to JusticeNow onboarding"
          onPress={() => router.push("/onboarding")}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy[900],
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  logo: {
    width: 92,
    height: 92,
  },

  brand: {
    marginTop: 24,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.textInverse,
  },

  brandAccent: {
    color: colors.teal[300],
  },

  tagline: {
    marginTop: 12,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    color: colors.navy[200],
  },

  loadingContainer: {
    marginTop: 40,
    width: 180,
    alignItems: "center",
  },

  loadingTrack: {
    width: 160,
    height: 4,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.navy[800],
  },

  loadingProgress: {
    width: "66%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.teal[400],
  },

  loadingText: {
    marginTop: 12,
    fontSize: 11.5,
    fontWeight: "500",
    textAlign: "center",
    color: colors.navy[300],
  },

  footer: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },

  sdgText: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    color: colors.navy[400],
  },

  continueButton: {
    minHeight: 40,
    marginTop: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.navy[700],
    borderRadius: 12,
  },

  continueButtonPressed: {
    backgroundColor: colors.navy[800],
  },

  continueText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[200],
  },
});