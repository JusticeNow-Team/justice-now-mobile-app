import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

const languages = [
  {
    code: "en",
    native: "English",
    label: "English",
  },
  {
    code: "si",
    native: "සිංහල",
    label: "Sinhala",
  },
  {
    code: "ta",
    native: "தமிழ்",
    label: "Tamil",
  },
];

export default function LanguageScreen() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] =
    useState("en");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            Choose your language
          </Text>

          <Text style={styles.subtitle}>
            භාෂාව තෝරන්න · மொழியைத் தேர்ந்தெடுக்கவும்
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>
          🌐 The whole app, including forms and notifications,
          will use this language.
        </Text>

        <View style={styles.languageList}>
          {languages.map((language) => {
            const selected =
              selectedLanguage === language.code;

            return (
              <Pressable
                key={language.code}
                onPress={() =>
                  setSelectedLanguage(language.code)
                }
                accessibilityRole="radio"
                accessibilityState={{
                  selected,
                }}
                style={[
                  styles.languageCard,
                  selected &&
                    styles.languageCardSelected,
                ]}
              >
                <View>
                  <Text style={styles.languageNative}>
                    {language.native}
                  </Text>

                  <Text style={styles.languageLabel}>
                    {language.label}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radio,
                    selected && styles.radioSelected,
                  ]}
                >
                  {selected && (
                    <Text style={styles.check}>✓</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            Interpreter support
          </Text>

          <Text style={styles.noticeText}>
            If you are more comfortable in another language,
            support organisations listed in the app can
            provide an interpreter.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/login")}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.continueText}>
            Continue
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },

  backText: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.navy[700],
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },

  subtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 20,
  },

  description: {
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  languageList: {
    gap: 10,
  },

  languageCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 16,
    paddingVertical: 14,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,

    backgroundColor: colors.surface,
  },

  languageCardSelected: {
    borderColor: colors.royal[500],
    backgroundColor: colors.royal[50],
  },

  languageNative: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.navy[800],
  },

  languageLabel: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },

  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,

    borderWidth: 2,
    borderColor: colors.navy[200],

    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },

  check: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: "700",
  },

  notice: {
    marginTop: 20,
    padding: 14,

    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.royal[100],

    backgroundColor: colors.royal[50],
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.royal[800],
  },

  noticeText: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  footer: {
    padding: 16,

    borderTopWidth: 1,
    borderTopColor: colors.border,

    backgroundColor: colors.surface,
  },

  continueButton: {
    minHeight: 50,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.royal[700],
  },

  pressed: {
    opacity: 0.88,
  },

  continueText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
});