import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../components/AppIcon";
import { colors, iconSizes } from "../theme";
import { getEvidenceAssignmentDetail, submitEvidenceDecision } from "./api";
import {
  ErrorCard,
  LoadingState,
  SectionCard,
  shortEvidenceId,
  ValidatorHeader,
} from "./components";
import { EvidenceDecision, ValidatorEvidenceItem } from "./types";

const DECISIONS: {
  value: EvidenceDecision;
  label: string;
  description: string;
  icon: AppIconName;
  color: string;
  selectedBackground: string;
  selectedBorder: string;
}[] = [
  {
    value: "approved",
    label: "Approve",
    description: "The file is usable and matches the reported context.",
    icon: "circle-check",
    color: colors.success,
    selectedBackground: "#ECF8F3",
    selectedBorder: "#9FD5C1",
  },
  {
    value: "rejected",
    label: "Reject",
    description: "The file cannot be accepted as evidence.",
    icon: "circle-x",
    color: colors.error,
    selectedBackground: "#FFF2F1",
    selectedBorder: "#E9AAA5",
  },
  {
    value: "replacement_requested",
    label: "Request replacement",
    description: "A clearer, complete or supported file is needed.",
    icon: "refresh-cw",
    color: colors.warning,
    selectedBackground: colors.gold[50],
    selectedBorder: colors.gold[300],
  },
  {
    value: "escalated",
    label: "Escalate",
    description: "A supervisor or specialist decision is required.",
    icon: "flag",
    color: "#8A6508",
    selectedBackground: "#FFF8E6",
    selectedBorder: colors.gold[300],
  },
];

const REASONS: Record<EvidenceDecision, string[]> = {
  approved: [
    "File is clear and relevant",
    "Metadata and case context are consistent",
    "Required checks completed",
    "Other",
  ],

  rejected: [
    "File is unrelated to the reported incident",
    "File is unreadable or corrupted",
    "Unsupported or unsafe content",
    "Other",
  ],

  replacement_requested: [
    "Image or document is unclear",
    "File is incomplete",
    "Required metadata is missing",
    "Wrong or unsupported file type",
    "Other",
  ],

  escalated: [
    "Possible integrity concern",
    "Sensitive content needs specialist review",
    "Case context is insufficient",
    "Supervisor decision required",
    "Other",
  ],
};

export default function EvidenceDecisionScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const assignmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<ValidatorEvidenceItem | null>(null);

  const [decision, setDecision] = useState<EvidenceDecision>(
    "replacement_requested",
  );

  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [otherReason, setOtherReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [reporterMessage, setReporterMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!assignmentId) {
        setErrorMessage("The evidence assignment identifier is missing.");
        setLoading(false);
        return;
      }

      try {
        const detail = await getEvidenceAssignmentDetail(assignmentId);

        if (active) {
          setItem(detail);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "JusticeNow could not load this evidence assignment.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [assignmentId]);

  const finalReason = useMemo(
    () => (reason === "Other" ? otherReason.trim() : reason.trim()),
    [otherReason, reason],
  );

  const detailHref = assignmentId
    ? (`/validator/evidence/${assignmentId}` as Href)
    : ("/validator/queue" as Href);

  const chooseDecision = (value: EvidenceDecision) => {
    setDecision(value);
    setReason("");
    setOtherReason("");
    setReasonOpen(false);
  };

  const saveDecision = async () => {
    if (!assignmentId || finalReason.length < 3) {
      return;
    }

    try {
      setSaving(true);

      await submitEvidenceDecision({
        assignmentId,
        decision,
        reason: finalReason,
        internalNotes,
        reporterMessage,
      });

      Alert.alert(
        "Decision recorded",
        "The evidence decision was saved to the audit trail.",
        [
          {
            text: "Back to queue",
            onPress: () => router.replace("/validator/queue"),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Decision not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDecision = () => {
    if (finalReason.length < 3) {
      Alert.alert(
        "Reason required",
        "Choose or enter a reason for this decision.",
      );
      return;
    }

    Alert.alert(
      "Submit evidence decision?",
      "This creates a permanent audit entry and completes the assignment.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Submit",
          onPress: () => void saveDecision(),
        },
      ],
    );
  };

  if (loading) {
    return <LoadingState label="Preparing decision form..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ValidatorHeader
        title="Record decision"
        subtitle={
          item
            ? `${shortEvidenceId(item.evidenceId)} · ${item.caseReference}`
            : undefined
        }
        backTo={detailHref}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? <ErrorCard message={errorMessage} /> : null}

        <View style={styles.options}>
          {DECISIONS.map((option) => {
            const selected = decision === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => chooseDecision(option.value)}
                style={({ pressed }) => [
                  styles.optionCard,
                  selected && {
                    borderColor: option.selectedBorder,
                    backgroundColor: option.selectedBackground,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    selected && {
                      borderColor: option.color,
                    },
                  ]}
                >
                  {selected ? (
                    <View
                      style={[
                        styles.radioDot,
                        {
                          backgroundColor: option.color,
                        },
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.optionIcon}>
                  <AppIcon name={option.icon} color={option.color} size={iconSizes.md} />
                </View>

                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.label}</Text>

                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionCard
          title="Decision reason"
          description="Required for the audit trail."
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              expanded: reasonOpen,
            }}
            onPress={() => setReasonOpen((value) => !value)}
            style={styles.selectButton}
          >
            <Text
              style={[styles.selectText, !reason && styles.placeholderText]}
            >
              {reason || "Select a reason"}
            </Text>

            <AppIcon name="chevron-down" color={colors.navy[500]} size={iconSizes.md} />
          </Pressable>

          {reasonOpen ? (
            <View style={styles.reasonMenu}>
              {REASONS[decision].map((option, index) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    setReason(option);
                    setReasonOpen(false);
                  }}
                  style={[
                    styles.reasonOption,
                    index === REASONS[decision].length - 1 &&
                      styles.reasonOptionLast,
                  ]}
                >
                  <Text style={styles.reasonOptionText}>{option}</Text>

                  {reason === option ? (
                    <AppIcon
                      name="check"
                      color={colors.royal[700]}
                      size={15}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {reason === "Other" ? (
            <TextInput
              value={otherReason}
              onChangeText={setOtherReason}
              placeholder="Enter the decision reason"
              placeholderTextColor={colors.textSoft}
              multiline
              maxLength={300}
              style={styles.textArea}
            />
          ) : null}
        </SectionCard>

        <SectionCard
          title="Validator notes"
          description="Internal only · visible to authorised staff."
        >
          <TextInput
            value={internalNotes}
            onChangeText={setInternalNotes}
            placeholder="Record observations, inconsistencies or follow-up details"
            placeholderTextColor={colors.textSoft}
            multiline
            maxLength={600}
            style={styles.textArea}
          />

          <Text style={styles.counter}>{internalNotes.length} / 600</Text>
        </SectionCard>

        <SectionCard
          title="Explanation for the reporter"
          description="Optional · plain language · do not expose internal notes."
        >
          <TextInput
            value={reporterMessage}
            onChangeText={setReporterMessage}
            placeholder="Explain what is needed without assigning blame"
            placeholderTextColor={colors.textSoft}
            multiline
            maxLength={400}
            style={styles.textArea}
          />

          <Text style={styles.counter}>{reporterMessage.length} / 400</Text>
        </SectionCard>

        <View style={styles.privacyCard}>
          <AppIcon name="lock" color={colors.navy[700]} size={iconSizes.sm} />

          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Your identity is protected</Text>

            <Text style={styles.privacyText}>
              Reporters see “Evidence validation team”, not your validator name
              or account identifier.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={saving}
          onPress={() => router.replace(detailHref)}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          disabled={saving || finalReason.length < 3}
          onPress={confirmDecision}
          style={({ pressed }) => [
            styles.submitButton,
            (saving || finalReason.length < 3) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.submitButtonText}>Submit decision</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
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
    opacity: 0.45,
  },

  options: {
    gap: 9,
  },

  optionCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },

  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.navy[300],
    borderRadius: 10,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  optionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  optionCopy: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },

  optionDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  selectButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    backgroundColor: colors.surface,
  },

  selectText: {
    flex: 1,
    fontSize: 13,
    color: colors.navy[800],
  },

  placeholderText: {
    color: colors.textSoft,
  },

  reasonMenu: {
    marginTop: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },

  reasonOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  reasonOptionLast: {
    borderBottomWidth: 0,
  },

  reasonOptionText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.navy[800],
  },

  textArea: {
    minHeight: 104,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 13,
    lineHeight: 19,
    textAlignVertical: "top",
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },

  counter: {
    marginTop: 6,
    fontSize: 10.5,
    textAlign: "right",
    color: colors.textSoft,
  },

  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.navy[100],
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },

  privacyCopy: {
    flex: 1,
  },

  privacyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[700],
  },

  privacyText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[700],
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  cancelButton: {
    minHeight: 48,
    flex: 0.9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[700],
  },

  submitButton: {
    minHeight: 48,
    flex: 1.6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },

  submitButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.surface,
  },
});
