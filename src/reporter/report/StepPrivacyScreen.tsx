import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { CheckboxRow, ChoiceCard, Notice } from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { ContactMethod } from "./types";

export default function StepPrivacyScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();

  return (
    <ReportStepLayout
      step={8}
      title="Your privacy preferences"
      intro="You decide how much is shared and how we contact you. These settings can be changed after submitting."
      nextLabel="Review my report"
      onContinue={() => router.push("/reporter/report/review")}
    >
      <View style={styles.card}>
        <CheckboxRow
          checked={draft.hideIdentity}
          onPress={() => updateDraft({ hideIdentity: !draft.hideIdentity })}
          label="Hide my identity from selected parties"
          hint="Your name is hidden from anyone outside the assigned investigator, including referral organisations."
        />
        <CheckboxRow
          checked={draft.allowContact}
          onPress={() => updateDraft({ allowContact: !draft.allowContact })}
          label="Allow the investigator to contact me"
          hint="Without this, you can still message the officer yourself at any time."
        />
        <CheckboxRow
          checked={draft.discreetNotifications}
          onPress={() =>
            updateDraft({ discreetNotifications: !draft.discreetNotifications })
          }
          label="Discreet notifications"
          hint="Alerts show only “JusticeNow update” with no case details on your lock screen."
        />
        <CheckboxRow
          checked={draft.stripLocationData}
          onPress={() =>
            updateDraft({ stripLocationData: !draft.stripLocationData })
          }
          label="Remove location data from my files"
          hint="Recommended if you are worried about being identified from an image or video."
        />
      </View>

      <Text style={styles.legend}>Preferred way to be contacted</Text>
      <View style={styles.stack}>
        {(
          [
            ["app", "Secure in-app message", "Most private option."],
            ["phone", "Phone call", "Only during hours you choose."],
            ["email", "Email", "Sent without case details in the subject line."],
          ] as [ContactMethod, string, string][]
        ).map(([value, title, description]) => (
          <ChoiceCard
            key={value}
            title={title}
            description={description}
            selected={draft.contactMethod === value}
            onPress={() => updateDraft({ contactMethod: value })}
          />
        ))}
      </View>

      <View style={styles.notice}>
        <Notice tone="privacy" title="Who can see your report?">
          One assigned investigator, one evidence validator and the audit
          system. Administrators can see that a case exists, but not its
          contents.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
