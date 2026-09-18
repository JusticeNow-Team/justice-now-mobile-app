import { useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { hasCompletedStaffMfa } from "../../auth";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { supabase } from "../../lib/supabase";
import { colors, iconSizes } from "../../theme";

type EvidenceType = "document" | "image" | "audio" | "video" | "text";

type ValidationStatus = "pending" | "under_review" | "verified" | "rejected";

type EvidenceDecision =
  | "approved"
  | "rejected"
  | "replacement_requested"
  | "escalated";

type CaseReviewAction =
  | "move_forward"
  | "request_information"
  | "request_clarification"
  | "reassign_evidence";

type CaseBrief = {
  id: string;
  case_reference: string;
  title: string;
};

type EvidenceItem = {
  id: string;

  case_id: string;

  evidence_type: EvidenceType;

  title: string;

  description: string | null;

  file_name: string | null;

  storage_bucket: string | null;

  storage_path: string | null;

  mime_type: string | null;

  file_size_bytes: number | null;

  validation_status: ValidationStatus;

  created_at: string;

  cases: CaseBrief | null;
};

type VerificationResultRow = {
  decision_id: string;
  assignment_id: string;
  evidence_id: string;
  evidence_title: string;
  file_name: string | null;
  case_id: string;
  case_reference: string;
  decision: EvidenceDecision;
  reason: string;
  internal_notes: string | null;
  reporter_message: string | null;
  decided_at: string;
  checker_id: string;
  checker_name: string;
  completed_at: string | null;
  case_action_id: string | null;
  case_action: CaseReviewAction | null;
  case_action_status: string | null;
  case_action_public_update: string | null;
  case_action_created_at: string | null;
};

type ReviewFilter = "all" | ValidationStatus;

export default function EvidenceReviewScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    caseId?: string | string[];
  }>();

  const caseId = Array.isArray(params.caseId)
    ? params.caseId[0]
    : params.caseId;

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const [verificationResults, setVerificationResults] = useState<
    VerificationResultRow[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<ReviewFilter>("all");

  const [errorMessage, setErrorMessage] = useState("");

  const [actingDecisionId, setActingDecisionId] = useState<string | null>(null);

  // -------------------------------------------------------
  // Load Evidence
  // -------------------------------------------------------

  const loadEvidence = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");

        // -----------------------------------------------
        // Require staff MFA
        // -----------------------------------------------

        const mfa = await hasCompletedStaffMfa();

        if (mfa.error) {
          setErrorMessage(mfa.error.message);

          return;
        }

        if (!mfa.verified) {
          router.replace("/two-factor");

          return;
        }

        // -----------------------------------------------
        // Evidence query
        // -----------------------------------------------

        let query = supabase
          .from("case_evidence")
          .select(
            `
                id,
                case_id,
                evidence_type,
                title,
                description,
                file_name,
                storage_bucket,
                storage_path,
                mime_type,
                file_size_bytes,
                validation_status,
                created_at,

                cases (
                  id,
                  case_reference,
                  title
                )
              `,
          )
          .order("created_at", {
            ascending: false,
          });

        if (caseId) {
          query = query.eq("case_id", caseId);
        }

        const [evidenceResponse, verificationResponse] = await Promise.all([
          query,
          supabase.rpc("get_officer_evidence_verification_results", {
            p_case_id: caseId ?? null,
          }),
        ]);

        const { data, error } = evidenceResponse;

        const { data: verificationData, error: verificationError } =
          verificationResponse;

        if (error) {
          setErrorMessage(error.message);

          return;
        }

        if (verificationError) {
          setErrorMessage(verificationError.message);

          return;
        }

        setEvidence((data ?? []) as unknown as EvidenceItem[]);
        setVerificationResults(
          (verificationData ?? []) as VerificationResultRow[],
        );
      } catch (error) {
        console.error("Load evidence error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load evidence.",
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [caseId, router],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEvidence();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadEvidence]);

  // -------------------------------------------------------
  // Refresh
  // -------------------------------------------------------

  const refresh = () => {
    setRefreshing(true);

    loadEvidence(false);
  };

  // -------------------------------------------------------
  // Filtering
  // -------------------------------------------------------

  const filteredEvidence = useMemo(() => {
    const query = search.trim().toLowerCase();

    return evidence.filter((item) => {
      const matchesSearch =
        query === "" ||
        item.title.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        (item.cases?.case_reference ?? "").toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      switch (filter) {
        case "pending":
        case "under_review":
        case "verified":
        case "rejected":
          return item.validation_status === filter;

        case "all":
        default:
          return true;
      }
    });
  }, [evidence, search, filter]);

  const resultByEvidenceId = useMemo(() => {
    const resultMap = new Map<string, VerificationResultRow>();

    verificationResults.forEach((result) => {
      if (!resultMap.has(result.evidence_id)) {
        resultMap.set(result.evidence_id, result);
      }
    });

    return resultMap;
  }, [verificationResults]);

  // -------------------------------------------------------
  // Open Evidence File
  // -------------------------------------------------------

  const openFile = async (item: EvidenceItem) => {
    if (!item.storage_bucket || !item.storage_path) {
      Alert.alert(
        "No digital file",
        "This evidence record currently contains metadata only. No file has been uploaded yet.",
      );

      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 60);

      if (error) {
        Alert.alert("Unable to open file", error.message);

        return;
      }

      if (!data?.signedUrl) {
        Alert.alert(
          "Unable to open file",
          "JusticeNow could not generate a secure file link.",
        );

        return;
      }

      await Linking.openURL(data.signedUrl);
    } catch (error) {
      console.error("Open evidence file error:", error);

      Alert.alert(
        "Unable to open file",
        "The evidence file could not be opened.",
      );
    }
  };

  const takeCaseAction = async (
    result: VerificationResultRow,
    action: CaseReviewAction,
  ) => {
    const actionLabel = formatCaseAction(action);
    const confirmMessage = getActionConfirmation(action);

    if (Platform.OS === "web") {
      const confirmed = window.confirm(confirmMessage);

      if (!confirmed) {
        return;
      }
    } else {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert("Confirm case action", confirmMessage, [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: actionLabel,
            onPress: () => resolve(true),
          },
        ]);
      });

      if (!confirmed) {
        return;
      }
    }

    try {
      setActingDecisionId(result.decision_id);

      const { error } = await supabase.rpc(
        "take_case_action_after_evidence_review",
        {
          p_decision_id: result.decision_id,
          p_action: action,
          p_public_update: getPublicUpdate(action),
          p_internal_note: getInternalActionNote(result, action),
        },
      );

      if (error) {
        throw error;
      }

      await loadEvidence(false);

      const message = `${actionLabel} recorded. The case timeline and Reporter update were created.`;

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Action recorded", message);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not record this case action.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Action failed", message);
      }
    } finally {
      setActingDecisionId(null);
    }
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading evidence...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name="chevron-left" size={iconSizes.headerBack} color={colors.navy[700]} />
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Case evidence</Text>

          <Text style={styles.headerSubtitle}>Case Officer Workspace</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>INVESTIGATION EVIDENCE</Text>

          <Text style={styles.heroTitle}>View case evidence</Text>

          <Text style={styles.heroText}>
            View submitted evidence connected to your assigned cases and send
            pending files to an Evidence Checker for validation.
          </Text>
        </View>

        {/* Important Boundary */}

        <View style={styles.infoBox}>
          <AppIcon name="info" size={16} color={colors.royal[700]} />

          <Text style={styles.infoText}>
            Case Officers can view and assign evidence. Verification decisions
            are handled only by authorized Evidence Checkers.
          </Text>
        </View>

        {/* Search */}

        <View style={styles.searchBox}>
          <AppIcon name="search" size={16} color={colors.textSoft} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search evidence or case ID"
            placeholderTextColor={colors.textSoft}
            style={styles.searchInput}
          />

          {search !== "" && (
            <Pressable onPress={() => setSearch("")}>
              <AppIcon name="x" size={16} color={colors.textSoft} />
            </Pressable>
          )}
        </View>

        {/* Filters */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            title="All"
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />

          <FilterChip
            title="Pending"
            active={filter === "pending"}
            onPress={() => setFilter("pending")}
          />

          <FilterChip
            title="Under review"
            active={filter === "under_review"}
            onPress={() => setFilter("under_review")}
          />

          <FilterChip
            title="Verified"
            active={filter === "verified"}
            onPress={() => setFilter("verified")}
          />

          <FilterChip
            title="Rejected"
            active={filter === "rejected"}
            onPress={() => setFilter("rejected")}
          />
        </ScrollView>

        {/* Error */}

        {errorMessage !== "" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Unable to load evidence</Text>

            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Results */}

        {errorMessage === "" && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Evidence</Text>

            <Text style={styles.resultsCount}>
              {filteredEvidence.length} item
              {filteredEvidence.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}

        {filteredEvidence.map((item) => {
          const verificationResult = resultByEvidenceId.get(item.id);

          return (
            <View key={item.id} style={styles.evidenceCard}>
              {/* Top */}

              <View style={styles.evidenceTop}>
                <View style={styles.typeIcon}>
                  <AppIcon name={getEvidenceIcon(item.evidence_type)} size={19} color={colors.royal[700]} />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.caseReference}>
                    {item.cases?.case_reference ?? "Case"}
                  </Text>

                  <Text style={styles.evidenceTitle}>{item.title}</Text>
                </View>

                <ValidationBadge status={item.validation_status} />
              </View>

              {/* Description */}

              <Text style={styles.evidenceDescription}>
                {item.description ?? "No description provided."}
              </Text>

              {/* Metadata */}

              <View style={styles.metadataRow}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metaLabel}>Type</Text>

                  <Text style={styles.metaValue}>
                    {formatEvidenceType(item.evidence_type)}
                  </Text>
                </View>

                <View style={styles.metadataItem}>
                  <Text style={styles.metaLabel}>Submitted</Text>

                  <Text style={styles.metaValue}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              </View>

              {verificationResult ? (
                <VerificationResultCard
                  result={verificationResult}
                  acting={actingDecisionId === verificationResult.decision_id}
                  onAction={(action) =>
                    void takeCaseAction(verificationResult, action)
                  }
                />
              ) : item.validation_status === "under_review" ? (
                <View style={styles.awaitingResultBox}>
                  <AppIcon
                    name="clock"
                    size={15}
                    color={colors.royal[700]}
                  />

                  <Text style={styles.awaitingResultText}>
                    This evidence is with an Evidence Checker. Verification
                    results will appear here after the checker submits a
                    decision.
                  </Text>
                </View>
              ) : null}

              {/* Actions */}

              <View style={styles.actions}>
                <Pressable
                  onPress={() => openFile(item)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>View file</Text>
                </Pressable>
              </View>

              {item.validation_status === "pending" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Assign ${item.title} to an Evidence Checker`}
                  onPress={() =>
                    router.push({
                      pathname: "/officer/assign-evidence",
                      params: {
                        caseId: item.case_id,
                        evidenceId: item.id,
                      },
                    })
                  }
                  style={styles.assignmentButton}
                >
                  <AppIcon
                    name="user-plus"
                    size={16}
                    color={colors.royal[700]}
                  />

                  <Text style={styles.assignmentButtonText}>
                    Assign to Evidence Checker
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {/* Empty */}

        {errorMessage === "" && filteredEvidence.length === 0 && (
          <View style={styles.emptyCard}>
            <AppIcon name="search" size={iconSizes.xl} color={colors.navy[700]} />

            <Text style={styles.emptyTitle}>No evidence found</Text>

            <Text style={styles.emptyText}>
              No evidence matches your current search or filter.
            </Text>
          </View>
        )}

        {/* Security */}

        <View style={styles.securityBox}>
          <AppIcon name="lock" size={16} color={colors.teal[800]} />

          <Text style={styles.securityText}>
            Evidence access is restricted to cases currently assigned to your
            authenticated Case Officer account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VerificationResultCard({
  result,
  acting,
  onAction,
}: {
  result: VerificationResultRow;
  acting: boolean;
  onAction: (action: CaseReviewAction) => void;
}) {
  const actions = getAvailableActions(result.decision);

  return (
    <View style={styles.verificationCard}>
      <View style={styles.verificationHeader}>
        <View>
          <Text style={styles.verificationEyebrow}>VERIFICATION RESULT</Text>

          <Text style={styles.verificationTitle}>
            {formatDecision(result.decision)}
          </Text>
        </View>

        <DecisionBadge decision={result.decision} />
      </View>

      <View style={styles.verificationMetaGrid}>
        <View style={styles.verificationMetaItem}>
          <Text style={styles.metaLabel}>Evidence Checker</Text>

          <Text style={styles.metaValue}>{result.checker_name}</Text>
        </View>

        <View style={styles.verificationMetaItem}>
          <Text style={styles.metaLabel}>Completed</Text>

          <Text style={styles.metaValue}>
            {formatDateTime(result.completed_at ?? result.decided_at)}
          </Text>
        </View>
      </View>

      <View style={styles.resultSection}>
        <Text style={styles.resultSectionTitle}>
          {result.decision === "rejected" ||
          result.decision === "replacement_requested"
            ? "Rejection reason"
            : "Verification comments"}
        </Text>

        <Text style={styles.resultSectionText}>{result.reason}</Text>
      </View>

      {result.internal_notes ? (
        <View style={styles.internalNotesBox}>
          <View style={styles.resultSectionHeader}>
            <AppIcon name="lock" size={14} color={colors.navy[700]} />

            <Text style={styles.resultSectionTitle}>Internal officer notes</Text>
          </View>

          <Text style={styles.resultSectionText}>{result.internal_notes}</Text>
        </View>
      ) : null}

      {result.reporter_message ? (
        <View style={styles.reporterMessageBox}>
          <View style={styles.resultSectionHeader}>
            <AppIcon name="message-square" size={14} color={colors.teal[800]} />

            <Text style={styles.resultSectionTitle}>
              Reporter-visible message
            </Text>
          </View>

          <Text style={styles.resultSectionText}>{result.reporter_message}</Text>
        </View>
      ) : null}

      {result.case_action_id ? (
        <View style={styles.actionRecordedBox}>
          <View style={styles.resultSectionHeader}>
            <AppIcon name="check-circle" size={14} color={colors.teal[800]} />

            <Text style={styles.resultSectionTitle}>Case action recorded</Text>
          </View>

          <Text style={styles.resultSectionText}>
            {result.case_action
              ? formatCaseAction(result.case_action)
              : "Action recorded"}{" "}
            {result.case_action_status
              ? `- case status is now ${formatStatusText(
                  result.case_action_status,
                )}.`
              : "for this verification result."}
          </Text>

          {result.case_action_public_update ? (
            <Text style={styles.resultSectionText}>
              Reporter update: {result.case_action_public_update}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.nextActionBox}>
          <Text style={styles.nextActionTitle}>Next case action</Text>

          <Text style={styles.nextActionHelp}>
            Choose one action based on the Evidence Checker result. Internal
            notes stay protected; the Reporter receives only the public update.
          </Text>

          <View style={styles.nextActionButtons}>
            {actions.map((action) => (
              <Pressable
                key={action}
                onPress={() => onAction(action)}
                disabled={acting}
                accessibilityRole="button"
                style={[
                  styles.caseActionButton,
                  action === "move_forward" && styles.caseActionPositive,
                  acting && styles.disabled,
                ]}
              >
                {acting ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      action === "move_forward"
                        ? colors.textInverse
                        : colors.royal[700]
                    }
                  />
                ) : (
                  <>
                    <AppIcon
                      name={getActionIcon(action)}
                      size={14}
                      color={
                        action === "move_forward"
                          ? colors.textInverse
                          : colors.royal[700]
                      }
                    />

                    <Text
                      style={[
                        styles.caseActionButtonText,
                        action === "move_forward" &&
                          styles.caseActionPositiveText,
                      ]}
                    >
                      {formatCaseAction(action)}
                    </Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function DecisionBadge({ decision }: { decision: EvidenceDecision }) {
  return (
    <View
      style={[
        styles.decisionBadge,
        decision === "approved" && styles.decisionApproved,
        decision === "rejected" && styles.decisionRejected,
        decision === "replacement_requested" && styles.decisionReplacement,
        decision === "escalated" && styles.decisionEscalated,
      ]}
    >
      <Text style={styles.decisionBadgeText}>{formatDecision(decision)}</Text>
    </View>
  );
}

// ---------------------------------------------------------
// Filter Chip
// ---------------------------------------------------------

function FilterChip({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------
// Validation Badge
// ---------------------------------------------------------

function ValidationBadge({ status }: { status: ValidationStatus }) {
  return (
    <View
      style={[
        styles.validationBadge,

        status === "verified" && styles.validationVerified,

        status === "rejected" && styles.validationRejected,

        status === "under_review" && styles.validationReview,
      ]}
    >
      <Text style={styles.validationText}>
        {formatValidationStatus(status)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------
// Formatting
// ---------------------------------------------------------

function getEvidenceIcon(type: EvidenceType): AppIconName {
  switch (type) {
    case "image":
      return "image";

    case "audio":
      return "mic";

    case "video":
      return "video";

    case "text":
      return "notebook-pen";

    case "document":
    default:
      return "file-text";
  }
}

function formatEvidenceType(type: EvidenceType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatValidationStatus(status: ValidationStatus) {
  switch (status) {
    case "under_review":
      return "Under review";

    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    case "pending":
    default:
      return "Pending";
  }
}

function formatDecision(decision: EvidenceDecision) {
  switch (decision) {
    case "approved":
      return "Approved";

    case "rejected":
      return "Rejected";

    case "replacement_requested":
      return "Replacement requested";

    case "escalated":
      return "Escalated";

    default:
      return decision;
  }
}

function getAvailableActions(decision: EvidenceDecision): CaseReviewAction[] {
  switch (decision) {
    case "approved":
      return ["move_forward"];

    case "rejected":
      return ["request_information"];

    case "replacement_requested":
      return ["request_information", "request_clarification"];

    case "escalated":
      return ["request_clarification", "reassign_evidence"];

    default:
      return [];
  }
}

function getActionIcon(action: CaseReviewAction): AppIconName {
  switch (action) {
    case "move_forward":
      return "arrow-right";

    case "request_information":
      return "message-square";

    case "request_clarification":
      return "circle-help";

    case "reassign_evidence":
      return "user-plus";

    default:
      return "circle";
  }
}

function formatCaseAction(action: CaseReviewAction) {
  switch (action) {
    case "move_forward":
      return "Move case forward";

    case "request_information":
      return "Request information";

    case "request_clarification":
      return "Request clarification";

    case "reassign_evidence":
      return "Reassign evidence";

    default:
      return action;
  }
}

function getActionConfirmation(action: CaseReviewAction) {
  switch (action) {
    case "move_forward":
      return "Move this case back into active investigation based on the verified evidence?";

    case "request_information":
      return "Send a secure additional-information request to the Reporter and mark the case as awaiting information?";

    case "request_clarification":
      return "Send a secure clarification request to the Reporter and mark the case as awaiting information?";

    case "reassign_evidence":
      return "Mark this evidence as pending again so it can be reassigned for another review?";

    default:
      return "Record this case action?";
  }
}

function getPublicUpdate(action: CaseReviewAction) {
  switch (action) {
    case "move_forward":
      return "Evidence review is complete and the case has moved back into active investigation.";

    case "request_information":
      return "The evidence review found that more information is needed. A secure request has been sent to you.";

    case "request_clarification":
      return "The evidence review is unclear. A secure clarification request has been sent before the next case decision.";

    case "reassign_evidence":
      return "The evidence needs another validation step before the case can move forward.";

    default:
      return "A case update was recorded after evidence review.";
  }
}

function getInternalActionNote(
  result: VerificationResultRow,
  action: CaseReviewAction,
) {
  return `${formatCaseAction(action)} recorded after ${formatDecision(
    result.decision,
  ).toLowerCase()} verification for "${result.evidence_title}".`;
}

function formatStatusText(status: string) {
  return status.replace(/_/g, " ");
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString();
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: 12,

    fontSize: 13,

    color: colors.textSecondary,
  },

  header: {
    minHeight: 66,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 14,

    borderBottomWidth: 1,

    borderBottomColor: colors.border,

    backgroundColor: colors.surface,
  },

  backButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "600",

    color: colors.navy[800],
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  hero: {
    padding: 18,

    borderRadius: 16,

    backgroundColor: colors.navy[800],
  },

  heroLabel: {
    fontSize: 10,

    fontWeight: "600",

    letterSpacing: 0.7,

    color: "#AEC3DC",
  },

  heroTitle: {
    marginTop: 5,

    fontSize: 19,

    fontWeight: "600",

    color: colors.textInverse,
  },

  heroText: {
    marginTop: 6,

    fontSize: 12,

    lineHeight: 18,

    color: "#DCE5EF",
  },

  infoBox: {
    flexDirection: "row",

    marginTop: 12,

    padding: 13,

    borderWidth: 1,

    borderColor: colors.royal[100],

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  infoText: {
    flex: 1,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  searchBox: {
    minHeight: 48,

    marginTop: 15,

    flexDirection: "row",
    alignItems: "center",

    gap: 8,

    paddingHorizontal: 13,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 12,

    backgroundColor: colors.surface,
  },

  searchInput: {
    flex: 1,

    fontSize: 13,

    color: colors.navy[800],
  },


  filters: {
    gap: 7,

    paddingVertical: 13,
  },

  filterChip: {
    minHeight: 34,

    paddingHorizontal: 13,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 18,

    backgroundColor: colors.surface,
  },

  filterChipActive: {
    borderColor: colors.royal[700],

    backgroundColor: colors.royal[700],
  },

  filterChipText: {
    fontSize: 11,

    fontWeight: "600",

    color: colors.navy[700],
  },

  filterChipTextActive: {
    color: colors.textInverse,
  },

  resultsHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    marginBottom: 9,
  },

  resultsTitle: {
    fontSize: 15,

    fontWeight: "600",

    color: colors.navy[800],
  },

  resultsCount: {
    fontSize: 11,

    color: colors.textSecondary,
  },

  evidenceCard: {
    marginBottom: 11,

    padding: 15,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  evidenceTop: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  typeIcon: {
    width: 43,
    height: 43,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  caseReference: {
    fontSize: 9.5,

    fontWeight: "600",

    color: colors.royal[700],
  },

  evidenceTitle: {
    marginTop: 2,

    fontSize: 13.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  evidenceDescription: {
    marginTop: 10,

    fontSize: 11.5,

    lineHeight: 17,

    color: colors.textSecondary,
  },

  metadataRow: {
    flexDirection: "row",

    marginTop: 12,

    gap: 10,
  },

  metadataItem: {
    flex: 1,
  },

  metaLabel: {
    fontSize: 9,

    color: colors.textSoft,
  },

  metaValue: {
    marginTop: 2,

    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[700],
  },

  validationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: colors.gold[50],
  },

  validationVerified: {
    backgroundColor: colors.teal[50],
  },

  validationRejected: {
    backgroundColor: "#FFF0EF",
  },

  validationReview: {
    backgroundColor: colors.royal[50],
  },

  validationText: {
    fontSize: 9,

    fontWeight: "600",

    color: colors.navy[700],
  },

  verificationCard: {
    marginTop: 13,

    padding: 12,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 12,

    backgroundColor: colors.teal[50],
  },

  verificationHeader: {
    flexDirection: "row",

    alignItems: "flex-start",
    justifyContent: "space-between",

    gap: 10,
  },

  verificationEyebrow: {
    fontSize: 9,

    fontWeight: "600",

    letterSpacing: 0.6,

    color: colors.teal[800],
  },

  verificationTitle: {
    marginTop: 3,

    fontSize: 13,

    fontWeight: "600",

    color: colors.navy[800],
  },

  decisionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: colors.navy[50],
  },

  decisionApproved: {
    backgroundColor: colors.teal[100],
  },

  decisionRejected: {
    backgroundColor: "#FFF0EF",
  },

  decisionReplacement: {
    backgroundColor: colors.gold[50],
  },

  decisionEscalated: {
    backgroundColor: colors.royal[50],
  },

  decisionBadgeText: {
    fontSize: 9,

    fontWeight: "600",

    color: colors.navy[700],
  },

  verificationMetaGrid: {
    flexDirection: "row",

    gap: 10,

    marginTop: 12,
  },

  verificationMetaItem: {
    flex: 1,
  },

  resultSection: {
    marginTop: 12,

    paddingTop: 11,

    borderTopWidth: 1,

    borderTopColor: colors.teal[100],
  },

  resultSectionHeader: {
    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  resultSectionTitle: {
    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  resultSectionText: {
    marginTop: 4,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  internalNotesBox: {
    marginTop: 10,

    padding: 10,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  reporterMessageBox: {
    marginTop: 10,

    padding: 10,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  awaitingResultBox: {
    flexDirection: "row",

    gap: 8,

    marginTop: 12,

    padding: 11,

    borderWidth: 1,

    borderColor: colors.royal[100],

    borderRadius: 10,

    backgroundColor: colors.royal[50],
  },

  awaitingResultText: {
    flex: 1,

    fontSize: 10.5,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  actionRecordedBox: {
    marginTop: 10,

    padding: 10,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  nextActionBox: {
    marginTop: 12,

    paddingTop: 11,

    borderTopWidth: 1,

    borderTopColor: colors.teal[100],
  },

  nextActionTitle: {
    fontSize: 11.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  nextActionHelp: {
    marginTop: 4,

    fontSize: 10.5,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  nextActionButtons: {
    flexDirection: "row",

    flexWrap: "wrap",

    gap: 8,

    marginTop: 10,
  },

  caseActionButton: {
    minHeight: 38,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 7,

    paddingHorizontal: 12,

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  caseActionPositive: {
    borderColor: colors.royal[700],

    backgroundColor: colors.royal[700],
  },

  caseActionButtonText: {
    fontSize: 10.5,

    fontWeight: "600",

    color: colors.royal[700],
  },

  caseActionPositiveText: {
    color: colors.textInverse,
  },

  reviewedBox: {
    marginTop: 12,

    padding: 11,

    borderRadius: 10,

    backgroundColor: colors.teal[50],
  },

  followUpBox: {
    marginTop: 12,

    padding: 11,

    borderRadius: 10,

    backgroundColor: colors.gold[50],
  },

  reviewStateText: {
    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  reviewFinding: {
    marginTop: 4,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  actions: {
    flexDirection: "row",

    gap: 8,

    marginTop: 13,
  },

  secondaryButton: {
    flex: 1,

    minHeight: 41,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 10,
  },

  secondaryButtonText: {
    fontSize: 11,

    fontWeight: "600",

    color: colors.royal[700],
  },

  assignmentButton: {
    minHeight: 41,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.royal[200],
    borderRadius: 10,
    backgroundColor: colors.royal[50],
  },

  assignmentButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.royal[700],
  },

  primaryButton: {
    flex: 1,

    minHeight: 41,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 10,

    backgroundColor: colors.royal[700],
  },

  primaryButtonText: {
    fontSize: 11,

    fontWeight: "600",

    color: colors.textInverse,
  },

  reviewComposer: {
    marginTop: 10,

    padding: 16,

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  composerLabel: {
    fontSize: 9.5,

    fontWeight: "600",

    letterSpacing: 0.6,

    color: colors.royal[700],
  },

  composerTitle: {
    marginTop: 4,

    fontSize: 15,

    fontWeight: "600",

    color: colors.navy[800],
  },

  composerHelp: {
    marginTop: 5,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  stateRow: {
    flexDirection: "row",

    gap: 8,

    marginTop: 14,
  },

  stateButton: {
    flex: 1,

    minHeight: 40,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 10,
  },

  stateButtonActive: {
    borderColor: colors.teal[600],

    backgroundColor: colors.teal[600],
  },

  stateButtonWarning: {
    borderColor: colors.warning,

    backgroundColor: colors.warning,
  },

  stateButtonText: {
    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[700],
  },

  stateButtonTextActive: {
    color: colors.textInverse,
  },

  findingInput: {
    minHeight: 115,

    marginTop: 12,

    padding: 12,

    borderWidth: 1,

    borderColor: colors.navy[200],

    borderRadius: 11,

    fontSize: 12,

    lineHeight: 18,

    color: colors.navy[800],

    backgroundColor: colors.background,
  },

  characterCount: {
    marginTop: 4,

    textAlign: "right",

    fontSize: 9.5,

    color: colors.textSoft,
  },

  composerActions: {
    flexDirection: "row",

    justifyContent: "flex-end",

    gap: 8,

    marginTop: 10,
  },

  cancelButton: {
    minHeight: 42,

    paddingHorizontal: 16,

    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    fontSize: 11.5,

    fontWeight: "600",

    color: colors.textSecondary,
  },

  saveButton: {
    minHeight: 42,

    minWidth: 115,

    paddingHorizontal: 15,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 10,

    backgroundColor: colors.royal[700],
  },

  saveText: {
    fontSize: 11.5,

    fontWeight: "600",

    color: colors.textInverse,
  },

  disabled: {
    opacity: 0.55,
  },

  errorBox: {
    padding: 14,

    borderWidth: 1,

    borderColor: colors.error,

    borderRadius: 12,

    backgroundColor: "#FFF2F1",
  },

  errorTitle: {
    fontSize: 12.5,

    fontWeight: "600",

    color: colors.error,
  },

  errorText: {
    marginTop: 4,

    fontSize: 11,

    color: colors.textSecondary,
  },

  emptyCard: {
    alignItems: "center",

    padding: 24,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  emptyTitle: {
    marginTop: 8,

    fontSize: 13,

    fontWeight: "600",

    color: colors.navy[800],
  },

  emptyText: {
    marginTop: 4,

    fontSize: 11,

    color: colors.textSecondary,
  },

  securityBox: {
    flexDirection: "row",

    gap: 8,

    marginTop: 15,

    padding: 13,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 12,

    backgroundColor: colors.teal[50],
  },

  securityText: {
    flex: 1,

    fontSize: 10.5,

    lineHeight: 16,

    color: colors.textSecondary,
  },
});

