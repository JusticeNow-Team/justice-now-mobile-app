import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { hasCompletedStaffMfa } from "../../auth";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { supabase } from "../../lib/supabase";
import { colors, iconSizes } from "../../theme";

type CaseOption = {
  id: string;
  case_reference: string;
  title: string;
  priority: string;
  status: string;
};

type EvidenceOption = {
  id: string;
  case_id: string;
  title: string;
  evidence_type: "document" | "image" | "audio" | "video" | "text";
  file_name: string | null;
  validation_status: string;
  created_at: string;
};

type CheckerOption = {
  id: string;
  full_name: string;
  active_assignment_count: number;
};

type EvidenceAssignment = {
  assignment_id: string;
  evidence_id: string;
  checker_id: string;
  checker_name: string;
  status: "assigned" | "under_review" | "completed" | "cancelled";
  assigned_at: string;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AssignEvidenceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    caseId?: string | string[];
    evidenceId?: string | string[];
  }>();

  const requestedCaseId = firstParam(params.caseId);
  const requestedEvidenceId = firstParam(params.evidenceId);
  const lockedToRequestedCase = Boolean(requestedCaseId);
  const lockedToRequestedEvidence = Boolean(requestedEvidenceId);

  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(requestedCaseId || "");
  const [evidence, setEvidence] = useState<EvidenceOption[]>([]);
  const [checkers, setCheckers] = useState<CheckerOption[]>([]);
  const [assignments, setAssignments] = useState<EvidenceAssignment[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(
    requestedEvidenceId || "",
  );
  const [selectedCheckerId, setSelectedCheckerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmingAssignment, setConfirmingAssignment] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadWorkspace = useCallback(async (caseId: string) => {
    if (!caseId) {
      setEvidence([]);
      setCheckers([]);
      setAssignments([]);
      return;
    }

    const [evidenceResult, checkerResult, assignmentResult] = await Promise.all(
      [
        supabase
          .from("case_evidence")
          .select(
            "id, case_id, title, evidence_type, file_name, validation_status, created_at",
          )
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_available_evidence_checkers", { p_case_id: caseId }),
        supabase.rpc("get_officer_evidence_assignments", { p_case_id: caseId }),
      ],
    );

    if (evidenceResult.error) {
      throw new Error(evidenceResult.error.message);
    }
    if (checkerResult.error) {
      throw new Error(checkerResult.error.message);
    }
    if (assignmentResult.error) {
      throw new Error(assignmentResult.error.message);
    }

    const allEvidence = (evidenceResult.data ?? []) as EvidenceOption[];
    const nextEvidence = requestedEvidenceId
      ? allEvidence.filter((item) => item.id === requestedEvidenceId)
      : allEvidence;
    const nextAssignments = (assignmentResult.data ?? []) as EvidenceAssignment[];
    setEvidence(nextEvidence);
    setCheckers(
      ((checkerResult.data ?? []) as {
        id: string;
        full_name: string;
        active_assignment_count: number | string;
      }[]).map((checker) => ({
        ...checker,
        active_assignment_count: Number(checker.active_assignment_count),
      })),
    );
    setAssignments(nextAssignments);

    setSelectedEvidenceId((current) => {
      if (requestedEvidenceId) {
        return nextEvidence.some((item) => item.id === requestedEvidenceId)
          ? requestedEvidenceId
          : "";
      }
      if (current && nextEvidence.some((item) => item.id === current)) {
        return current;
      }
      return (
        nextEvidence.find(
          (item) =>
            item.validation_status === "pending" &&
            !nextAssignments.some(
              (assignment) =>
                assignment.evidence_id === item.id &&
                ["assigned", "under_review"].includes(assignment.status),
            ),
        )?.id ||
        nextEvidence[0]?.id ||
        ""
      );
    });
  }, [requestedEvidenceId]);

  const loadPage = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }
        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const mfa = await hasCompletedStaffMfa();

        if (mfa.error) {
          throw new Error(mfa.error.message);
        }
        if (!mfa.verified) {
          router.replace("/two-factor");
          return;
        }

        const { data: caseAssignments, error: caseError } = await supabase
          .from("case_assignments")
          .select(
            `
              assigned_at,
              cases (
                id,
                case_reference,
                title,
                priority,
                status
              )
            `,
          )
          .eq("assigned_officer_id", user.id)
          .eq("is_active", true)
          .order("assigned_at", { ascending: false });

        if (caseError) {
          throw new Error(caseError.message);
        }

        const allAssignedCases = (caseAssignments ?? [])
          .map((row: any) => row.cases)
          .filter(Boolean) as CaseOption[];
        const assignedCases = requestedCaseId
          ? allAssignedCases.filter((caseItem) => caseItem.id === requestedCaseId)
          : allAssignedCases;

        if (requestedCaseId && assignedCases.length === 0) {
          throw new Error(
            "This case is not assigned to your Case Officer account.",
          );
        }

        setCases(assignedCases);

        const nextCaseId =
          requestedCaseId ||
          (selectedCaseId &&
          assignedCases.some((caseItem) => caseItem.id === selectedCaseId)
            ? selectedCaseId
            : "") ||
          assignedCases[0]?.id ||
          "";

        setSelectedCaseId(nextCaseId);
        await loadWorkspace(nextCaseId);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load evidence assignments.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadWorkspace, requestedCaseId, router, selectedCaseId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPage]);

  const selectedCase = useMemo(
    () => cases.find((caseItem) => caseItem.id === selectedCaseId) || null,
    [cases, selectedCaseId],
  );

  const selectedEvidence = useMemo(
    () => evidence.find((item) => item.id === selectedEvidenceId) || null,
    [evidence, selectedEvidenceId],
  );

  const currentAssignment = useMemo(
    () =>
      assignments.find(
        (item) =>
          item.evidence_id === selectedEvidenceId &&
          ["assigned", "under_review"].includes(item.status),
      ) || null,
    [assignments, selectedEvidenceId],
  );

  const selectCase = async (caseId: string) => {
    if (lockedToRequestedCase) {
      return;
    }

    if (caseId === selectedCaseId) {
      return;
    }
    try {
      setSelectedCaseId(caseId);
      setSelectedEvidenceId("");
      setSelectedCheckerId("");
      setLoading(true);
      setErrorMessage("");
      await loadWorkspace(caseId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load this case.",
      );
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const requestAssignment = () => {
    if (!selectedEvidenceId || !selectedCheckerId) {
      showMessage(
        "Selection required",
        "Select one evidence item and one Evidence Checker.",
      );
      return;
    }

    if (selectedEvidence?.validation_status !== "pending" || currentAssignment) {
      showMessage(
        "Evidence unavailable",
        "Only pending evidence without an active assignment can be assigned.",
      );
      return;
    }

    setConfirmingAssignment(true);
  };

  const assignEvidence = async () => {
    if (!selectedEvidenceId || !selectedCheckerId) {
      return;
    }

    try {
      setAssigning(true);
      const { error } = await supabase.rpc("assign_evidence_to_checker", {
        p_evidence_id: selectedEvidenceId,
        p_checker_id: selectedCheckerId,
      });

      if (error) {
        showMessage("Assignment failed", error.message);
        return;
      }

      await loadWorkspace(selectedCaseId);
      setSelectedCheckerId("");
      setConfirmingAssignment(false);
      showMessage(
        "Evidence assigned",
        "The Evidence Checker can now see this item in the validation queue.",
      );
    } catch (error) {
      showMessage(
        "Assignment failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.royal[700]} />
        <Text style={styles.loadingText}>Loading assignment workspace...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <AppIcon
            name="chevron-left"
            size={iconSizes.headerBack}
            color={colors.navy[700]}
          />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Assign evidence</Text>
          <Text style={styles.headerSubtitle}>
            Send selected files to an Evidence Checker
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Refresh"
          onPress={() => void loadPage()}
          style={styles.headerButton}
        >
          <AppIcon
            name="refresh-cw"
            size={iconSizes.md}
            color={colors.navy[700]}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadPage(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notice}>
          <AppIcon name="shield-check" size={20} color={colors.teal[700]} />
          <Text style={styles.noticeText}>
            Assign only the selected evidence required for independent validation. The
            action is recorded against your Case Officer account.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <AppIcon name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <SectionHeading
          step="1"
          title={lockedToRequestedCase ? "Assigned case" : "Select an assigned case"}
          detail={
            lockedToRequestedCase ? "Locked from case flow" : `${cases.length} available`
          }
        />

        {cases.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="No assigned cases"
            body="A case must be assigned to your officer account before its evidence can be delegated."
          />
        ) : lockedToRequestedCase ? null : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.caseRow}
          >
            {cases.map((caseItem) => {
              const active = caseItem.id === selectedCaseId;
              return (
                <Pressable
                  key={caseItem.id}
                  onPress={() => void selectCase(caseItem.id)}
                  style={[styles.caseCard, active && styles.caseCardActive]}
                >
                  <Text
                    style={[
                      styles.caseReference,
                      active && styles.caseReferenceActive,
                    ]}
                  >
                    {caseItem.case_reference}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.caseTitle, active && styles.caseTitleActive]}
                  >
                    {caseItem.title}
                  </Text>
                  <Text
                    style={[styles.caseMeta, active && styles.caseMetaActive]}
                  >
                    {caseItem.priority.toUpperCase()} ·{" "}
                    {caseItem.status.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selectedCase ? (
          <View style={styles.selectedCaseBanner}>
            <Text style={styles.selectedCaseLabel}>SELECTED CASE</Text>
            <Text style={styles.selectedCaseTitle}>{selectedCase.title}</Text>
          </View>
        ) : null}

        <SectionHeading
          step="2"
          title={lockedToRequestedEvidence ? "Evidence to assign" : "Select evidence"}
          detail={
            lockedToRequestedEvidence
              ? "Locked from evidence flow"
              : `${evidence.length} item${evidence.length === 1 ? "" : "s"}`
          }
        />

        {selectedCase && evidence.length === 0 ? (
          <EmptyState
            icon="file-search"
            title="No evidence submitted"
            body="This case does not yet contain an evidence record that can be assigned."
          />
        ) : (
          evidence.map((item) => {
            const active = item.id === selectedEvidenceId;
            const assigned = assignments.find(
              (assignment) =>
                assignment.evidence_id === item.id &&
                ["assigned", "under_review"].includes(assignment.status),
            );
            const selectable =
              item.validation_status === "pending" || Boolean(assigned);

            return (
              <Pressable
                key={item.id}
                disabled={!selectable || lockedToRequestedEvidence}
                onPress={() => {
                  setSelectedEvidenceId(item.id);
                  setSelectedCheckerId("");
                }}
                style={[
                  styles.evidenceCard,
                  active && styles.evidenceCardActive,
                  !selectable && styles.unavailableCard,
                ]}
              >
                <View style={styles.fileIcon}>
                  <AppIcon
                    name={evidenceIcon(item.evidence_type)}
                    size={20}
                    color={colors.royal[700]}
                  />
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.evidenceTitle}>{item.title}</Text>
                  <Text style={styles.evidenceMeta} numberOfLines={1}>
                    {item.file_name || formatEvidenceType(item.evidence_type)} ·{" "}
                    {formatDate(item.created_at)}
                  </Text>
                  {assigned ? (
                    <Text style={styles.assignedText}>
                      {assigned.checker_name} ·{" "}
                      {assigned.status.replace(/_/g, " ")}
                    </Text>
                  ) : item.validation_status === "pending" ? (
                    <Text style={styles.unassignedText}>Not assigned</Text>
                  ) : (
                    <Text style={styles.unavailableText}>
                      {item.validation_status.replace(/_/g, " ")} · unavailable
                    </Text>
                  )}
                </View>
                <AppIcon
                  name={active ? "circle-check" : "circle"}
                  size={21}
                  color={active ? colors.royal[700] : colors.navy[300]}
                />
              </Pressable>
            );
          })
        )}

        {selectedEvidence ? (
          <>
            <SectionHeading
              step="3"
              title="Select an Evidence Checker"
              detail={`${checkers.length} available`}
            />

            {selectedEvidence.validation_status !== "pending" ? (
              <View style={styles.alreadyAssignedCard}>
                <AppIcon name="info" size={20} color={colors.royal[700]} />
                <View style={styles.flexOne}>
                  <Text style={styles.alreadyAssignedTitle}>
                    Evidence is not pending
                  </Text>
                  <Text style={styles.alreadyAssignedText}>
                    Only pending evidence can be assigned for validation.
                  </Text>
                </View>
              </View>
            ) : currentAssignment ? (
              <View style={styles.alreadyAssignedCard}>
                <AppIcon name="info" size={20} color={colors.royal[700]} />
                <View style={styles.flexOne}>
                  <Text style={styles.alreadyAssignedTitle}>
                    Already assigned
                  </Text>
                  <Text style={styles.alreadyAssignedText}>
                    {currentAssignment.checker_name} ·{" "}
                    {currentAssignment.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
            ) : checkers.length === 0 ? (
              <EmptyState
                icon="users"
                title="No Evidence Checker available"
                body="Ask the administrator to create and activate an Evidence Checker account."
              />
            ) : (
              checkers.map((checker) => {
                const active = checker.id === selectedCheckerId;
                return (
                  <Pressable
                    key={checker.id}
                    onPress={() => setSelectedCheckerId(checker.id)}
                    style={[
                      styles.checkerCard,
                      active && styles.checkerCardActive,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {initials(checker.full_name)}
                      </Text>
                    </View>
                    <View style={styles.flexOne}>
                      <Text style={styles.checkerName}>
                        {checker.full_name}
                      </Text>
                      <Text style={styles.checkerMeta}>
                        {checker.active_assignment_count} active assignment
                        {checker.active_assignment_count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <AppIcon
                      name={active ? "circle-check" : "circle"}
                      size={21}
                      color={active ? colors.royal[700] : colors.navy[300]}
                    />
                  </Pressable>
                );
              })
            )}

            {selectedEvidence.validation_status === "pending" &&
            !currentAssignment &&
            checkers.length > 0 ? (
              <Pressable
                onPress={requestAssignment}
                disabled={!selectedCheckerId || assigning}
                style={[
                  styles.assignButton,
                  (!selectedCheckerId || assigning) && styles.disabledButton,
                ]}
              >
                {assigning ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <>
                    <AppIcon
                      name="user-plus"
                      size={18}
                      color={colors.textInverse}
                    />
                    <Text style={styles.assignButtonText}>
                      Assign to checker
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}

        {assignments.length > 0 ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Case assignment summary</Text>
            <Text style={styles.summaryText}>
              {assignments.filter((item) => item.status !== "cancelled").length}{" "}
              evidence assignment
              {assignments.filter((item) => item.status !== "cancelled")
                .length === 1
                ? ""
                : "s"}{" "}
              recorded for this case.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirmingAssignment}
        title="Assign evidence?"
        body={`${selectedEvidence?.title ?? "This evidence"} will be assigned to ${
          checkers.find((checker) => checker.id === selectedCheckerId)?.full_name ??
          "the selected Evidence Checker"
        }. The action will be recorded in the case timeline.`}
        confirmLabel="Assign evidence"
        loading={assigning}
        onClose={() => {
          if (!assigning) {
            setConfirmingAssignment(false);
          }
        }}
        onConfirm={() => void assignEvidence()}
      />
    </SafeAreaView>
  );
}

function SectionHeading({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepText}>{step}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDetail}>{detail}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: AppIconName;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <AppIcon name={icon} size={26} color={colors.navy[400]} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
    </View>
  );
}

function evidenceIcon(type: EvidenceOption["evidence_type"]): AppIconName {
  if (type === "image") return "image";
  if (type === "audio") return "mic";
  if (type === "video") return "video";
  if (type === "text") return "notebook-pen";
  return "file-text";
}

function formatEvidenceType(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerCopy: { flex: 1, paddingHorizontal: 4 },
  headerTitle: { color: colors.navy[800], fontSize: 18, fontWeight: "600" },
  headerSubtitle: { marginTop: 2, color: colors.textSecondary, fontSize: 11.5 },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 36 },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.teal[200],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },
  noticeText: {
    flex: 1,
    color: colors.teal[800],
    fontSize: 12.5,
    lineHeight: 18,
  },
  errorCard: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0B7B3",
    borderRadius: 14,
    backgroundColor: "#FFF2F1",
  },
  errorText: { flex: 1, color: colors.error, fontSize: 12.5, lineHeight: 18 },
  sectionHeading: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.navy[800],
  },
  stepText: { color: colors.textInverse, fontSize: 12, fontWeight: "600" },
  sectionTitle: {
    flex: 1,
    color: colors.navy[800],
    fontSize: 15,
    fontWeight: "600",
  },
  sectionDetail: { color: colors.textSecondary, fontSize: 11.5 },
  caseRow: { gap: 10, paddingRight: 8 },
  caseCard: {
    width: 220,
    minHeight: 112,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  caseCardActive: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[700],
  },
  caseReference: { color: colors.royal[700], fontSize: 11, fontWeight: "600" },
  caseReferenceActive: { color: colors.royal[100] },
  caseTitle: {
    marginTop: 7,
    color: colors.navy[800],
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  caseTitleActive: { color: colors.textInverse },
  caseMeta: { marginTop: 8, color: colors.textSecondary, fontSize: 10.5 },
  caseMetaActive: { color: colors.royal[100] },
  selectedCaseBanner: {
    marginTop: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold[400],
    borderRadius: 8,
    backgroundColor: colors.gold[50],
  },
  selectedCaseLabel: {
    color: colors.gold[500],
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  selectedCaseTitle: {
    marginTop: 3,
    color: colors.navy[800],
    fontSize: 13,
    fontWeight: "600",
  },
  evidenceCard: {
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  evidenceCardActive: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },
  unavailableCard: { opacity: 0.55 },
  fileIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[100],
  },
  flexOne: { flex: 1 },
  evidenceTitle: { color: colors.navy[800], fontSize: 13.5, fontWeight: "600" },
  evidenceMeta: { marginTop: 3, color: colors.textSecondary, fontSize: 11 },
  assignedText: {
    marginTop: 5,
    color: colors.teal[700],
    fontSize: 10.5,
    fontWeight: "600",
  },
  unassignedText: {
    marginTop: 5,
    color: colors.warning,
    fontSize: 10.5,
    fontWeight: "600",
  },
  unavailableText: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  checkerCard: {
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  checkerCardActive: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },
  avatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.navy[800],
  },
  avatarText: { color: colors.textInverse, fontSize: 13, fontWeight: "600" },
  checkerName: { color: colors.navy[800], fontSize: 13.5, fontWeight: "600" },
  checkerMeta: { marginTop: 3, color: colors.textSecondary, fontSize: 11 },
  alreadyAssignedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.royal[200],
    borderRadius: 14,
    backgroundColor: colors.royal[50],
  },
  alreadyAssignedTitle: {
    color: colors.navy[800],
    fontSize: 13,
    fontWeight: "600",
  },
  alreadyAssignedText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 11.5,
  },
  assignButton: {
    minHeight: 48,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 13,
    backgroundColor: colors.royal[700],
  },
  disabledButton: { opacity: 0.45 },
  assignButtonText: {
    color: colors.textInverse,
    fontSize: 13.5,
    fontWeight: "600",
  },
  emptyCard: {
    alignItems: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: 9,
    color: colors.navy[800],
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 5,
    maxWidth: 290,
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
  },
  summaryCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.navy[800],
  },
  summaryTitle: { color: colors.textInverse, fontSize: 13, fontWeight: "600" },
  summaryText: {
    marginTop: 4,
    color: colors.navy[100],
    fontSize: 11.5,
    lineHeight: 17,
  },
});
