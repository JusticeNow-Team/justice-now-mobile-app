import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Notice } from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";

export default function StepEvidenceScreen() {
  const router = useRouter();

  return (
    <ReportStepLayout
      step={7}
      title="Add anything that supports your report"
      intro="Photos, videos, voice recordings or documents all help. If you have nothing to add, that is completely fine."
      skipLabel="Skip — I have no files to add"
      onSkip={() => router.push("/reporter/report/privacy")}
      onContinue={() => router.push("/reporter/report/privacy")}
    >
      <View style={styles.box}>
        <Text style={styles.icon}>⬆</Text>
        <Text style={styles.title}>File upload comes next</Text>
        <Text style={styles.copy}>
          You can submit this case without files. Evidence upload will be
          connected in a later step. Up to 100 MB per file · JPG, PNG, MP4, M4A,
          PDF
        </Text>
      </View>
      <View style={styles.notice}>
        <Notice tone="privacy" title="Your files are protected">
          Files are encrypted on upload and reviewed only by authorised
          personnel.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  icon: {
    fontSize: 22,
    color: colors.royal[700],
  },
  title: {
    marginTop: 8,
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  copy: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  notice: {
    marginTop: 16,
  },
});
