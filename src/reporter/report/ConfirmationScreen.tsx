import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Notice, PrimaryButton } from "../../components/common";
import { colors } from "../../theme";
import { useReport } from "./ReportContext";

function formatSubmittedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function ConfirmationScreen() {
  const router = useRouter();
  const { submitted, resetDraft } = useReport();

  if (!submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Notice tone="info" title="No submitted case">
            Start a new report from the reporter dashboard.
          </Notice>
          <View style={styles.actions}>
            <PrimaryButton
              title="Return home"
              onPress={() => router.replace("/reporter")}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.check}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title}>
            Your report has been submitted securely
          </Text>
          <Text style={styles.copy}>
            Thank you for trusting us with this. What you shared is now
            protected and in the hands of authorised staff only.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Case reference</Text>
          <Text selectable style={styles.reference}>
            {submitted.caseReference}
          </Text>
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Submitted</Text>
              <Text style={styles.metaValue}>
                {formatSubmittedAt(submitted.submittedAt)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Current status</Text>
              <Text style={[styles.metaValue, styles.status]}>Submitted</Text>
            </View>
            <View style={[styles.metaRow, styles.metaLast]}>
              <Text style={styles.metaLabel}>Reporting mode</Text>
              <Text style={styles.metaValue}>
                {submitted.reportingMode === "anonymous"
                  ? "Anonymous"
                  : "With my identity"}
              </Text>
            </View>
          </View>
        </View>

        {submitted.evidenceWarning ? (
          <View style={styles.notice}>
            <Notice tone="caution" title="Evidence needs another try">
              {submitted.evidenceWarning}
            </Notice>
          </View>
        ) : null}

        <View style={styles.notice}>
          <Notice tone="privacy" title="Keep your reference safe">
            You will need {submitted.caseReference} to follow this case. It is
            also saved under My cases in your account.
          </Notice>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title="Return home"
          variant="outline"
          onPress={() => {
            resetDraft();
            router.replace("/reporter");
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hero: {
    alignItems: "center",
    paddingTop: 16,
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8F2",
  },
  checkMark: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.success,
  },
  title: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.navy[800],
  },
  copy: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  reference: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy[800],
  },
  meta: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  metaLast: {
    paddingBottom: 0,
  },
  metaLabel: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  metaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  status: {
    color: colors.info,
  },
  notice: {
    marginTop: 16,
  },
  actions: {
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
