import { Image } from "expo-image";
import {
  Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../components/AppIcon";
import { colors, iconSizes } from "../theme";
import {
  createEvidenceSignedUrl,
  getEvidenceAssignmentDetail,
  startEvidenceReview,
} from "./api";
import {
  cardShadow,
  DetailRow,
  ErrorCard,
  evidenceIconName,
  formatBytes,
  formatDateTime,
  formatLabel,
  LoadingState,
  SectionCard,
  shortEvidenceId,
  StatusBadge,
  ValidatorHeader,
} from "./components";
import { ValidatorEvidenceItem } from "./types";

const CHECKLIST = [
  "The file opens and is readable",
  "The content is relevant to the reported incident",
  "The evidence matches the described category",
  "Available metadata was reviewed",
  "Sensitive content was handled appropriately",
];

type CheckResult = "passed" | "warning" | "failed";

export default function EvidenceDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const assignmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<ValidatorEvidenceItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const [checked, setChecked] = useState(CHECKLIST.map(() => false));

  const [errorMessage, setErrorMessage] = useState("");

  const loadDetail = useCallback(async () => {
    if (!assignmentId) {
      setErrorMessage("The evidence assignment identifier is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const detail = await getEvidenceAssignmentDetail(assignmentId);

      if (detail.assignmentStatus === "assigned") {
        await startEvidenceReview(assignmentId);

        detail.assignmentStatus = "under_review";
        detail.startedAt = new Date().toISOString();
      }

      setItem(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load this evidence assignment.",
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
      return undefined;
    }, [loadDetail]),
  );

  const automatedChecks = useMemo(() => {
    if (!item) {
      return [];
    }

    const hasFile = Boolean(item.storageBucket && item.storagePath);

    const withinLimit =
      item.fileSizeBytes !== null && item.fileSizeBytes <= 100 * 1024 * 1024;

    return [
      {
        label: "Secure storage reference",
        result: hasFile ? "passed" : "failed",
        value: hasFile ? "Available" : "Missing",
      },
      {
        label: "File size within 100 MB",
        result:
          item.fileSizeBytes === null
            ? "warning"
            : withinLimit
              ? "passed"
              : "failed",
        value:
          item.fileSizeBytes === null
            ? "Not recorded"
            : withinLimit
              ? "Passed"
              : "Exceeded",
      },
      {
        label: "MIME type recorded",
        result: item.mimeType ? "passed" : "warning",
        value: item.mimeType || "Not recorded",
      },
      {
        label: "Required evidence metadata",
        result:
          item.evidenceTitle && item.evidenceType && item.evidenceCreatedAt
            ? "passed"
            : "warning",
        value: item.evidenceTitle && item.evidenceType ? "Complete" : "Review",
      },
    ] as {
      label: string;
      result: CheckResult;
      value: string;
    }[];
  }, [item]);

  const revealPreview = async () => {
    if (!item) {
      return;
    }

    try {
      setPreviewing(true);

      const url = await createEvidenceSignedUrl(item, 60);

      if (item.mimeType?.startsWith("image/")) {
        setPreviewUrl(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert(
        "Preview unavailable",
        error instanceof Error
          ? error.message
          : "The secure preview could not be opened.",
      );
    } finally {
      setPreviewing(false);
    }
  };

  if (loading) {
    return <LoadingState label="Opening secure evidence..." />;
  }

  if (!item || errorMessage) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ValidatorHeader title="Evidence review" backTo="/validator/queue" />

        <View style={styles.errorWrap}>
          <ErrorCard
            message={errorMessage || "This evidence assignment was not found."}
          />
        </View>
      </SafeAreaView>
    );
  }

  const allChecked = checked.every(Boolean);
  const isImage = item.mimeType?.startsWith("image/");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ValidatorHeader
        title={shortEvidenceId(item.evidenceId)}
        subtitle={item.caseReference}
        backTo="/validator/queue"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryCard, cardShadow]}>
          <View style={styles.summaryIcon}>
            <AppIcon
              name={evidenceIconName(item.evidenceType)}
              color={colors.navy[600]}
              size={20}
            />
          </View>

          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {item.fileName || item.evidenceTitle}
            </Text>

            <Text style={styles.summaryMeta} numberOfLines={1}>
              {formatLabel(item.evidenceType)} ·{" "}
              {formatBytes(item.fileSizeBytes)}
            </Text>

            <View style={styles.summaryBadge}>
              <StatusBadge status={item.assignmentStatus} />
            </View>
          </View>
        </View>

        <View style={[styles.previewCard, cardShadow]}>
          {previewUrl && isImage ? (
            <Image
              source={{ uri: previewUrl }}
              contentFit="contain"
              style={styles.previewImage}
            />
          ) : (
            <View style={styles.previewHidden}>
              <View style={styles.previewIcon}>
                <AppIcon name="eye-off" color={colors.navy[200]} size={iconSizes.xl} />
              </View>

              <Text style={styles.previewTitle}>Sensitive preview hidden</Text>

              <Text style={styles.previewText}>
                Reveal only when you are ready to review this evidence.
              </Text>

              <Pressable
                disabled={previewing}
                onPress={() => void revealPreview()}
                style={({ pressed }) => [
                  styles.revealButton,
                  previewing && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name="eye-off" color={colors.surface} size={iconSizes.sm} />

                <Text style={styles.revealButtonText}>
                  {previewing
                    ? "Preparing preview..."
                    : isImage
                      ? "Reveal preview"
                      : "Open secure preview"}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.previewFooter}>
            <AppIcon name="lock" color={colors.navy[300]} size={iconSizes.xs} />

            <Text style={styles.previewFooterText}>
              Temporary signed access · expires after 60 seconds
            </Text>
          </View>
        </View>

        <SectionCard title="File information">
          <DetailRow
            label="File name"
            value={item.fileName || "Not recorded"}
          />

          <DetailRow
            label="Evidence type"
            value={formatLabel(item.evidenceType)}
          />

          <DetailRow
            label="File size"
            value={formatBytes(item.fileSizeBytes)}
          />

          <DetailRow
            label="MIME type"
            value={item.mimeType || "Not recorded"}
            last
          />
        </SectionCard>

        <SectionCard title="Metadata">
          <DetailRow
            label="Evidence ID"
            value={shortEvidenceId(item.evidenceId)}
          />

          <DetailRow
            label="Uploaded"
            value={formatDateTime(item.evidenceCreatedAt)}
          />

          <DetailRow label="Assigned" value={formatDateTime(item.assignedAt)} />

          <DetailRow
            label="Review started"
            value={formatDateTime(item.startedAt)}
            last
          />
        </SectionCard>

        <SectionCard title="Reporter description">
          <Text style={styles.bodyText}>
            {item.evidenceDescription?.trim() || "No description was provided."}
          </Text>
        </SectionCard>

        <SectionCard title="Case context">
          <DetailRow label="Case" value={item.caseReference} />

          <DetailRow label="Case title" value={item.caseTitle} />

          <DetailRow label="Category" value={formatLabel(item.caseCategory)} />

          <DetailRow
            label="Incident date"
            value={item.caseIncidentDate || "Not recorded"}
          />

          <DetailRow
            label="Reporter identity"
            value={item.isAnonymous ? "Anonymous" : "Identity protected"}
            last
          />
        </SectionCard>

        <SectionCard
          title="Automated checks"
          description="Only checks backed by stored file data are shown."
        >
          {automatedChecks.map((check, index) => (
            <AutomatedCheck
              key={check.label}
              label={check.label}
              value={check.value}
              result={check.result}
              last={index === automatedChecks.length - 1}
            />
          ))}
        </SectionCard>

        <View style={styles.duplicateCard}>
          <AppIcon name="info" color={colors.warning} size={iconSizes.sm} />

          <View style={styles.duplicateCopy}>
            <Text style={styles.duplicateTitle}>Duplicate comparison</Text>

            <Text style={styles.duplicateText}>
              No server-side duplicate result is available for this record.
              Review the case context manually before deciding.
            </Text>
          </View>
        </View>

        <SectionCard
          title="Validator checklist"
          description="Complete each check before recording a decision."
        >
          {CHECKLIST.map((label, index) => (
            <Pressable
              key={label}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: checked[index],
              }}
              onPress={() =>
                setChecked((current) =>
                  current.map((value, itemIndex) =>
                    itemIndex === index ? !value : value,
                  ),
                )
              }
              style={[
                styles.checklistRow,
                index === CHECKLIST.length - 1 && styles.checklistRowLast,
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  checked[index] && styles.checkboxChecked,
                ]}
              >
                {checked[index] ? (
                  <AppIcon name="check" color={colors.surface} size={iconSizes.xs} />
                ) : null}
              </View>

              <Text style={styles.checklistText}>{label}</Text>
            </Pressable>
          ))}
        </SectionCard>
      </ScrollView>

      <View style={styles.footer}>
        {!allChecked ? (
          <Text style={styles.footerHint}>
            Complete the checklist to continue
          </Text>
        ) : null}

        <Pressable
          disabled={!allChecked}
          onPress={() =>
            router.push(
              `/validator/evidence/${item.assignmentId}/decision` as Href,
            )
          }
          style={({ pressed }) => [
            styles.decisionButton,
            !allChecked && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.decisionButtonText}>Record decision</Text>

          <AppIcon name="arrow-up-right" color={colors.surface} size={iconSizes.md} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function AutomatedCheck({
  label,
  value,
  result,
  last,
}: {
  label: string;
  value: string;
  result: CheckResult;
  last: boolean;
}) {
  const tones: Record<
    CheckResult,
    {
      color: string;
      icon: AppIconName;
    }
  > = {
    passed: {
      color: colors.success,
      icon: "circle-check",
    },
    warning: {
      color: colors.warning,
      icon: "alert-triangle",
    },
    failed: {
      color: colors.error,
      icon: "circle-x",
    },
  };

  const current = tones[result];

  return (
    <View style={[styles.automatedRow, last && styles.automatedRowLast]}>
      <AppIcon name={current.icon} color={current.color} size={iconSizes.sm} />

      <View style={styles.automatedCopy}>
        <Text style={styles.automatedLabel}>{label}</Text>

        <Text style={[styles.automatedValue, { color: current.color }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },

  pressed: {
    opacity: 0.68,
  },

  disabled: {
    opacity: 0.48,
  },

  errorWrap: {
    padding: 16,
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  summaryIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.navy[50],
  },

  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },

  summaryMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  summaryBadge: {
    marginTop: 8,
    alignItems: "flex-start",
  },

  previewCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.navy[700],
    borderRadius: 16,
    backgroundColor: colors.navy[900],
  },

  previewHidden: {
    minHeight: 238,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  previewIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.navy[800],
  },

  previewTitle: {
    marginTop: 13,
    fontSize: 15,
    fontWeight: "600",
    color: colors.surface,
  },

  previewText: {
    marginTop: 4,
    maxWidth: 260,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    color: colors.navy[200],
  },

  revealButton: {
    marginTop: 15,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.royal[700],
  },

  revealButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.surface,
  },

  previewImage: {
    width: "100%",
    height: 260,
    backgroundColor: colors.navy[900],
  },

  previewFooter: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.navy[700],
    backgroundColor: colors.navy[800],
  },

  previewFooterText: {
    fontSize: 10.5,
    color: colors.navy[300],
  },

  bodyText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  automatedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  automatedRowLast: {
    borderBottomWidth: 0,
  },

  automatedCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  automatedLabel: {
    flex: 1,
    fontSize: 12.5,
    color: colors.navy[800],
  },

  automatedValue: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "right",
  },

  duplicateCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gold[200],
    borderRadius: 12,
    backgroundColor: colors.gold[50],
  },

  duplicateCopy: {
    flex: 1,
  },

  duplicateTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.warning,
  },

  duplicateText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  checklistRow: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  checklistRowLast: {
    borderBottomWidth: 0,
  },

  checkbox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.navy[300],
    borderRadius: 6,
    backgroundColor: colors.surface,
  },

  checkboxChecked: {
    borderColor: colors.teal[600],
    backgroundColor: colors.teal[600],
  },

  checklistText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.navy[800],
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  footerHint: {
    marginBottom: 7,
    fontSize: 11,
    textAlign: "center",
    color: colors.textSecondary,
  },

  decisionButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },

  decisionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.surface,
  },
});
