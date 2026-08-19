import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AppTextInput,
  ChoiceCard,
  Field,
  Notice,
  SelectInput,
} from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { ageOptions, genderOptions } from "./options";
import { validateReportStep } from "./validation";

export default function StepVictimScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [error, setError] = useState("");

  return (
    <ReportStepLayout
      step={5}
      title="Who was affected?"
      intro="Only fill in what you know. Every field on this step is optional except the first question."
      error={error}
      onContinue={() => {
        const message = validateReportStep(5, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/witness");
      }}
    >
      <Text style={styles.legend}>Are you reporting for yourself?</Text>
      <View style={styles.stack}>
        <ChoiceCard
          title="I am the affected person"
          selected={draft.victimRelation === "self"}
          onPress={() => {
            updateDraft({ victimRelation: "self" });
            setError("");
          }}
        />
        <ChoiceCard
          title="I am reporting for another person"
          description="You may be a family member, friend, colleague or a support worker."
          selected={draft.victimRelation === "other"}
          onPress={() => {
            updateDraft({ victimRelation: "other" });
            setError("");
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>About the affected person</Text>
        <Field label="Name" optional>
          <AppTextInput
            value={draft.victimName}
            onChangeText={(victimName) => updateDraft({ victimName })}
            placeholder="Leave blank if you prefer"
          />
        </Field>
        <Field label="Approximate age" optional>
          <SelectInput
            value={draft.victimAge}
            options={ageOptions.map((item) => ({ value: item, label: item }))}
            onChange={(victimAge) => updateDraft({ victimAge })}
          />
        </Field>
        <Field label="Gender" optional>
          <SelectInput
            value={draft.victimGender}
            options={genderOptions.map((item) => ({ value: item, label: item }))}
            onChange={(victimGender) => updateDraft({ victimGender })}
          />
        </Field>
        <Field
          label="Contact information"
          optional
          hint="Only used if the person agrees to be contacted."
        >
          <AppTextInput
            value={draft.victimContact}
            onChangeText={(victimContact) => updateDraft({ victimContact })}
            placeholder="Phone or email"
          />
        </Field>
        <Field label="Your relationship to this person" optional>
          <AppTextInput
            value={draft.victimRelationship}
            onChangeText={(victimRelationship) =>
              updateDraft({ victimRelationship })
            }
            placeholder="e.g. Brother"
          />
        </Field>
      </View>

      <View style={styles.notice}>
        <Notice tone="caution" title="Reporting for someone else">
          Where possible, please make sure the affected person knows about this
          report. If that is not safe or possible, you can still continue.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  legend: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  stack: {
    gap: 8,
  },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  section: {
    marginBottom: 12,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  notice: {
    marginTop: 16,
  },
});
