import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Notice } from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { validateReportStep } from "./validation";

const options = [
  {
    id: "identified" as const,
    icon: "👤",
    title: "Report with my identity",
    points: [
      "Your officer can contact you directly for updates and questions",
      "Your name is visible only to the assigned officer and validator",
      "You can still hide your identity from other parties later",
    ],
  },
  {
    id: "anonymous" as const,
    icon: "◌",
    title: "Report anonymously",
    points: [
      "No name, contact number or device details are stored with the case",
      "You still receive a case reference and can follow progress",
      "Officers can only reach you through secure in-app messages",
    ],
  },
];

export default function StepPreferenceScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [error, setError] = useState("");

  return (
    <ReportStepLayout
      step={1}
      title="How would you like to report this case?"
      intro="Both options are investigated in the same way. Choose whichever feels safer for you."
      error={error}
      onContinue={() => {
        const message = validateReportStep(1, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/category");
      }}
    >
      <View style={styles.stack}>
        {options.map((option) => {
          const selected = draft.reportingMode === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => {
                updateDraft({ reportingMode: option.id });
                setError("");
              }}
              style={[styles.card, selected && styles.cardSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
              <View style={styles.content}>
                <Text style={styles.cardTitle}>
                  {option.icon}  {option.title}
                </Text>
                {option.points.map((point) => (
                  <Text key={point} style={styles.point}>
                    •  {point}
                  </Text>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.notice}>
        <Notice tone="privacy" title="You can change your mind">
          Until you submit, you can switch between identified and anonymous
          reporting at any step.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.royal[500],
    backgroundColor: colors.royal[50],
  },
  radio: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.navy[300],
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textInverse,
  },
  content: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },
  point: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  notice: {
    marginTop: 16,
  },
});
