import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppHeader,
  ConfirmDialog,
  Notice,
  PrimaryButton,
  StepProgress,
} from "../../components/common";
import { colors } from "../../theme";
import { uploadPendingEvidence } from "../evidence/uploadEvidence";
import { logoutReporter } from "../login";
import { incidentCategories, reportSteps } from "./options";
import { useReport } from "./ReportContext";
import { submitReporterCase } from "./submitReporterCase";
import { validateReportStep } from "./validation";

export default function StepReviewScreen() {
  const router = useRouter();
  const { draft, setSubmitted } = useReport();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categoryLabel = draft.categories
    .map((id) => incidentCategories.find((item) => item.id === id)?.label ?? id)
    .join(", ");

  const sections = [
    {
      title: "Incident",
      path: "/reporter/report/details",
      rows: [
        ["Category", categoryLabel || "—"],
        ["Title", draft.title || "—"],
        [
          "Date & time",
          `${draft.incidentDate}${draft.incidentTime ? `, around ${draft.incidentTime}` : ""}`,
        ],
        ["Still ongoing", draft.ongoing || "—"],
        ["Description", draft.description || "—"],
      ],
    },
    {
      title: "Location",
      path: "/reporter/report/location",
      rows: [
        ["Province", draft.province],
        ["District", draft.district],
        ["Area", draft.city || "—"],
        [
          "Exact location",
          draft.hideExactLocation
            ? "Shared with investigator only"
            : draft.specificLocation || "—",
        ],
      ],
    },
    {
      title: "People",
      path: "/reporter/report/victim",
      rows: [
        [
          "Reporting as",
          draft.victimRelation === "self"
            ? "I am the affected person"
            : "For another person",
        ],
        ["Affected person", draft.victimName || "Name not provided"],
        ["Approximate age", draft.victimAge],
        ["Witnesses", `${draft.witnesses.length} added`],
      ],
    },
    {
      title: "Evidence",
      path: "/reporter/report/evidence",
      rows: [
        [
          "Files attached",
          draft.pendingEvidence.length === 0
            ? "None in this submission"
            : `${draft.pendingEvidence.length} file${
                draft.pendingEvidence.length === 1 ? "" : "s"
              } ready to upload`,
        ],
      ],
    },
    {
      title: "Privacy preferences",
      path: "/reporter/report/privacy",
      rows: [
        [
          "Reporting mode",
          draft.reportingMode === "anonymous"
            ? "Anonymous"
            : "With my identity",
        ],
        [
          "Identity hidden from",
          draft.hideIdentity
            ? "All parties except assigned investigator"
            : "Not hidden",
        ],
        ["Contact allowed", draft.allowContact ? "Yes" : "No"],
        [
          "Notifications",
          draft.discreetNotifications ? "Discreet mode on" : "Standard",
        ],
        ["Preferred contact", draft.contactMethod],
      ],
    },
  ];

  const handleSubmit = async () => {
    const requiredSteps = [1, 2, 3, 4, 5];
    const firstError = requiredSteps
      .map((step) => validateReportStep(step, draft))
      .find(Boolean);

    if (firstError) {
      setConfirming(false);
      setError(firstError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const result = await submitReporterCase(draft);

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          await logoutReporter().catch(() => undefined);
          router.replace("/login");
          return;
        }

        setConfirming(false);
        setError(result.message);
        return;
      }

      let evidenceWarning: string | undefined;

      if (draft.pendingEvidence.length > 0) {
        const upload = await uploadPendingEvidence(
          result.id,
          draft.pendingEvidence
        );

        if (upload.failed > 0) {
          evidenceWarning =
            upload.uploaded > 0
              ? "Your case was submitted, but some files could not be uploaded. You can add them from the case page."
              : upload.lastError ||
                "Your case was submitted, but the files could not be uploaded. You can add them from the case page.";
        }
      }

      setSubmitted({
        id: result.id,
        caseReference: result.caseReference,
        submittedAt: result.submittedAt,
        reportingMode: draft.reportingMode,
        evidenceWarning,
      });
      setConfirming(false);
      router.replace("/reporter/report/confirmation");
    } catch {
      setConfirming(false);
      setError("We could not submit your case. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader
        title="Review your report"
        onBack={() => router.replace("/reporter/report/privacy")}
      />
      <StepProgress current={9} total={reportSteps.length} label="Review" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Please check everything below. Nothing has been sent yet — you can
          edit any section.
        </Text>

        {error ? (
          <View style={styles.notice}>
            <Notice tone="error" title="Unable to submit">
              {error}
            </Notice>
          </View>
        ) : null}

        <View style={styles.stack}>
          {sections.map((section) => (
            <View key={section.title} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{section.title}</Text>
                <Pressable onPress={() => router.push(section.path as any)}>
                  <Text style={styles.edit}>Edit</Text>
                </Pressable>
              </View>
              {section.rows.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowValue}>{value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Notice tone="safety" title="Before you submit">
            Your report is encrypted in transit and at rest. Only the assigned
            investigator and evidence validator will be able to open it.
          </Notice>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Submit report" onPress={() => setConfirming(true)} />
      </View>

      <ConfirmDialog
        visible={confirming}
        title="Submit this report?"
        body="Your report will be sent securely to the case intake team. You can still add information afterwards, and you can withdraw the case at any time."
        confirmLabel="Yes, submit"
        cancelLabel="Keep editing"
        loading={saving}
        onConfirm={handleSubmit}
        onClose={() => {
          if (!saving) {
            setConfirming(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  stack: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  edit: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.royal[700],
  },
  row: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.7)",
  },
  rowLabel: {
    width: 108,
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  rowValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "500",
    lineHeight: 18,
    color: colors.navy[800],
  },
  notice: {
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
