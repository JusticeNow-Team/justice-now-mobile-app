import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

const slides = [
  {
    icon: "🛡️",
    title: "Report human rights violations safely",
    body:
      "You can report an incident that happened to you or to someone else. Share only what you feel comfortable sharing — you can pause and continue at any time.",
  },
  {
    icon: "📎",
    title: "Submit supporting evidence",
    body:
      "Add photos, videos, audio or documents. Files are securely handled and seen only by authorised personnel working on your case.",
  },
  {
    icon: "📈",
    title: "Track your case",
    body:
      "Follow every step from submission to outcome. You will be notified when your case moves forward or when something is needed from you.",
  },
  {
    icon: "🔒",
    title: "Your privacy matters",
    body:
      "You choose what is shared and with whom. Report anonymously, protect your identity and turn on discreet notifications at any time.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  const handleContinue = () => {
    if (!isLastSlide) {
      setCurrentSlide((previous) => previous + 1);
      return;
    }

    router.push("/language");
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide((previous) => previous - 1);
    } else {
      router.back();
    }
  };

  const handleSkip = () => {
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.topButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          style={styles.topButton}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{slide.icon}</Text>
        </View>

        <Text style={styles.title}>{slide.title}</Text>

        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.progressRow}>
        {slides.map((_, index) => {
          const active = index === currentSlide;

          return (
            <Pressable
              key={index}
              onPress={() => setCurrentSlide(index)}
              accessibilityRole="button"
              accessibilityLabel={`Go to onboarding step ${index + 1}`}
            >
              <View
                style={[
                  styles.progressDot,
                  active
                    ? styles.progressDotActive
                    : styles.progressDotInactive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel={
            isLastSlide ? "Get started" : "Continue"
          }
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isLastSlide ? "Get Started" : "Continue"}
          </Text>
        </Pressable>

        {isLastSlide && (
          <Text style={styles.footerHint}>
            You can change your language and privacy settings later.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  topButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },

  backText: {
    fontSize: 32,
    lineHeight: 34,
    color: colors.navy[700],
  },

  skipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  iconBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.royal[50],
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: 34,
  },

  title: {
    marginTop: 28,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "700",
    color: colors.navy[800],
  },

  body: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  progressRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 16,
  },

  progressDot: {
    height: 6,
    borderRadius: 20,
  },

  progressDotActive: {
    width: 28,
    backgroundColor: colors.royal[700],
  },

  progressDotInactive: {
    width: 12,
    backgroundColor: colors.navy[200],
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[700],
  },

  primaryButtonPressed: {
    opacity: 0.88,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },

  footerHint: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});