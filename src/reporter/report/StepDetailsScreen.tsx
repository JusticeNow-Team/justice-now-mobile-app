import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AppTextArea,
  AppTextInput,
  ChoiceCard,
  Field,
  Notice,
} from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { OngoingStatus } from "./types";
import { validateReportStep } from "./validation";

export default function StepDetailsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [error, setError] = useState("");

  return (
    <ReportStepLayout
      step={3}
      title="Tell us what happened"
      intro="Share as much detail as you feel comfortable sharing. You can stop and continue later, and you can edit anything before you submit."
      error={error}
      onContinue={() => {
        const message = validateReportStep(3, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/location");
      }}
    >
      <View style={styles.card}>
        <Field
          label="Case title"
          hint="A short line that helps you recognise this case."
        >
          <AppTextInput
            value={draft.title}
            onChangeText={(title) => {
              updateDraft({ title });
              setError("");
            }}
            placeholder="e.g. Prolonged detention without charge"
            accessibilityLabel="Case title"
          />
        </Field>

        <Field
          label="What happened?"
          hint="Include what you saw or experienced, who was involved and anything that felt unusual."
        >
          <AppTextArea
            value={draft.description}
            onChangeText={(description) => {
              updateDraft({ description });
              setError("");
            }}
            placeholder="Take your time…"
            maxLength={4000}
            accessibilityLabel="What happened?"
          />
        </Field>
        <Text style={styles.counter}>
          {draft.description.length} / 4000 characters
        </Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label="Date of incident"
              hint="Use YYYY-MM-DD. Future dates are not allowed."
            >
              <AppTextInput
                value={draft.incidentDate}
                onChangeText={(incidentDate) => {
                  updateDraft({ incidentDate });
                  setError("");
                }}
                placeholder="YYYY-MM-DD"
                accessibilityLabel="Date of incident"
              />
            </Field>
          </View>
          <View style={styles.half}>
            <Field label="Approximate time" optional>
              <AppTextInput
                value={draft.incidentTime}
                onChangeText={(incidentTime) => updateDraft({ incidentTime })}
                placeholder="HH:MM"
                accessibilityLabel="Approximate time"
              />
            </Field>
          </View>
        </View>
      </View>

      <Text style={styles.legend}>Is the incident still ongoing?</Text>
      <View style={styles.stack}>
        {(
          [
            ["yes", "Yes, it is still happening"],
            ["no", "No, it has ended"],
            ["unsure", "I am not sure"],
          ] as [OngoingStatus, string][]
        ).map(([value, title]) => (
          <ChoiceCard
            key={value}
            title={title}
            selected={draft.ongoing === value}
            onPress={() => {
              updateDraft({ ongoing: value });
              setError("");
            }}
          />
        ))}
      </View>

      <View style={styles.notice}>
        <Notice tone="caution" title="Take a break if you need one">
          Writing about a difficult experience can be hard. You can go back and
          edit anything before you submit.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  counter: {
    marginTop: -8,
    marginBottom: 12,
    textAlign: "right",
    fontSize: 11,
    color: colors.textSoft,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  legend: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  stack: {
    gap: 8,
  },
  notice: {
    marginTop: 16,
  },
});
