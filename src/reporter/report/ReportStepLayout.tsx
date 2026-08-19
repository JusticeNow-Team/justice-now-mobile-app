import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, Notice, PrimaryButton, StepProgress } from "../../components/common";
import { colors } from "../../theme";
import { reportSteps } from "./options";

interface ReportStepLayoutProps {
  step: number;
  title: string;
  intro?: string;
  children: ReactNode;
  nextLabel?: string;
  onContinue: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  error?: string;
}

export default function ReportStepLayout({
  step,
  title,
  intro,
  children,
  nextLabel = "Continue",
  onContinue,
  skipLabel,
  onSkip,
  error,
}: ReportStepLayoutProps) {
  const router = useRouter();
  const meta = reportSteps[step - 1];
  const backPath =
    step === 1 ? "/reporter" : reportSteps[step - 2]?.path ?? "/reporter";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader
          title="Report a case"
          onBack={() => router.replace(backPath)}
        />
        <StepProgress
          current={step}
          total={reportSteps.length}
          label={meta?.label ?? ""}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{title}</Text>
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
          <View style={styles.body}>{children}</View>
          {error ? (
            <View style={styles.errorWrap}>
              <Notice tone="error">{error}</Notice>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.backBtn}>
              <PrimaryButton
                title="Back"
                variant="outline"
                onPress={() => router.replace(backPath)}
              />
            </View>
            <View style={styles.nextBtn}>
              <PrimaryButton title={nextLabel} onPress={onContinue} />
            </View>
          </View>
          {onSkip && skipLabel ? (
            <Pressable onPress={onSkip} style={styles.skip}>
              <Text style={styles.skipText}>{skipLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    color: colors.navy[800],
  },
  intro: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  body: {
    marginTop: 16,
  },
  errorWrap: {
    marginTop: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  backBtn: {
    flex: 0.42,
  },
  nextBtn: {
    flex: 1,
  },
  skip: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
