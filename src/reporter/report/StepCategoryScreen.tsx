import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ChoiceCard, Notice } from "../../components/common";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { incidentCategories } from "./options";
import { validateReportStep } from "./validation";

export default function StepCategoryScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [error, setError] = useState("");

  const toggle = (id: string) => {
    const selected = draft.categories.includes(id);
    updateDraft({
      categories: selected
        ? draft.categories.filter((item) => item !== id)
        : [...draft.categories, id],
    });
    setError("");
  };

  return (
    <ReportStepLayout
      step={2}
      title="What kind of incident are you reporting?"
      intro="Choose everything that applies. If you are not sure, pick the closest one — your officer can adjust it later."
      error={error}
      onContinue={() => {
        const message = validateReportStep(2, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/details");
      }}
    >
      <View style={styles.stack}>
        {incidentCategories.map((category) => (
          <ChoiceCard
            key={category.id}
            multi
            title={category.label}
            description={category.hint}
            selected={draft.categories.includes(category.id)}
            onPress={() => toggle(category.id)}
          />
        ))}
      </View>
      <View style={styles.notice}>
        <Notice tone="info">
          Categories help route your case to an officer with the right
          experience. They are never shown to anyone outside JusticeNow.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  notice: {
    marginTop: 16,
  },
});
