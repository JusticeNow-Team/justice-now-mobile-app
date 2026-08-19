import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppTextArea,
  AppTextInput,
  Field,
  Notice,
  PrimaryButton,
} from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";

export default function StepWitnessScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();

  const updateWitness = (
    index: number,
    patch: Partial<(typeof draft.witnesses)[number]>
  ) => {
    const next = draft.witnesses.map((witness, current) =>
      current === index ? { ...witness, ...patch } : witness
    );
    updateDraft({ witnesses: next });
  };

  return (
    <ReportStepLayout
      step={6}
      title="Was anyone else there?"
      intro="Witnesses can help confirm what happened, but they are never contacted without care. You can skip this step."
      skipLabel="Skip — no witnesses to add"
      onSkip={() => {
        updateDraft({ witnesses: [] });
        router.push("/reporter/report/evidence");
      }}
      onContinue={() => router.push("/reporter/report/evidence")}
    >
      {draft.witnesses.map((witness, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Witness {index + 1}</Text>
            <Pressable
              onPress={() =>
                updateDraft({
                  witnesses: draft.witnesses.filter((_, current) => current !== index),
                })
              }
            >
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
          <View style={styles.body}>
            <Field label="Name" optional>
              <AppTextInput
                value={witness.name}
                onChangeText={(name) => updateWitness(index, { name })}
                placeholder="Leave blank if you prefer"
              />
            </Field>
            <Field
              label="Contact"
              optional
              hint="Only used with the witness’s agreement."
            >
              <AppTextInput
                value={witness.contact}
                onChangeText={(contact) => updateWitness(index, { contact })}
                placeholder="Phone or email"
              />
            </Field>
            <Field label="What did they see?" optional>
              <AppTextArea
                value={witness.seen}
                onChangeText={(seen) => updateWitness(index, { seen })}
                placeholder="A short description"
                style={{ minHeight: 90 }}
              />
            </Field>
          </View>
        </View>
      ))}

      <PrimaryButton
        title="Add another witness"
        variant="outline"
        onPress={() =>
          updateDraft({
            witnesses: [
              ...draft.witnesses,
              { name: "", contact: "", seen: "" },
            ],
          })
        }
      />

      <View style={styles.notice}>
        <Notice tone="privacy" title="Protecting witnesses">
          Witness details are stored separately from the main case record and
          are opened only when the investigator needs to verify an account.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  remove: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.errorStrong,
  },
  body: {
    padding: 16,
  },
  notice: {
    marginTop: 16,
  },
});
