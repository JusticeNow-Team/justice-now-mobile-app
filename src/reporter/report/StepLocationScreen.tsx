import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppTextInput,
  CheckboxRow,
  Field,
  Notice,
  SelectInput,
} from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { districts, provinces } from "./options";
import { validateReportStep } from "./validation";

export default function StepLocationScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [error, setError] = useState("");

  return (
    <ReportStepLayout
      step={4}
      title="Where did this happen?"
      intro="An approximate area is enough. Share an exact location only if you feel safe doing so."
      error={error}
      onContinue={() => {
        const message = validateReportStep(4, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/victim");
      }}
    >
      <View style={styles.card}>
        <Field label="Province">
          <SelectInput
            value={draft.province}
            options={provinces.map((item) => ({ value: item, label: item }))}
            onChange={(province) => {
              updateDraft({ province });
              setError("");
            }}
            accessibilityLabel="Province"
          />
        </Field>
        <Field label="District">
          <SelectInput
            value={draft.district}
            options={districts.map((item) => ({ value: item, label: item }))}
            onChange={(district) => {
              updateDraft({ district });
              setError("");
            }}
            accessibilityLabel="District"
          />
        </Field>
        <Field label="City or area" optional>
          <AppTextInput
            value={draft.city}
            onChangeText={(city) => updateDraft({ city })}
            placeholder="e.g. Maradana"
            accessibilityLabel="City or area"
          />
        </Field>
        <Field
          label="Specific location"
          optional
          hint="For example a building, street or landmark."
        >
          <AppTextInput
            value={draft.specificLocation}
            onChangeText={(specificLocation) =>
              updateDraft({ specificLocation })
            }
            placeholder="e.g. Near the station entrance"
            editable={!draft.hideExactLocation}
            accessibilityLabel="Specific location"
          />
        </Field>
      </View>

      <View style={[styles.card, styles.gap]}>
        <CheckboxRow
          checked={draft.hideExactLocation}
          onPress={() =>
            updateDraft({ hideExactLocation: !draft.hideExactLocation })
          }
          label="I do not want to disclose the exact location"
          hint="Your case will show the district only. Your officer may ask about it later, and you can still decline."
        />
      </View>

      <View style={styles.notice}>
        <Notice tone="privacy" title="Who can see this?">
          Location is visible to the assigned investigator and the evidence
          validator. It is hidden from any external organisation unless you
          agree to a referral.
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
  gap: {
    marginTop: 16,
  },
  notice: {
    marginTop: 16,
  },
});
