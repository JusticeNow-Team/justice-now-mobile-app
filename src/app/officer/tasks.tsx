import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../../components/AppIcon";
import { supabase } from "../../lib/supabase";
import { colors, iconSizes } from "../../theme";

type CaseStatus =
  | "submitted"
  | "under_review"
  | "assigned"
  | "investigating"
  | "awaiting_information"
  | "awaiting_evidence"
  | "resolved"
  | "closed";

type CasePriority = "low" | "medium" | "high" | "urgent";

type OfficerCase = {
  id: string;
  case_reference: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  updated_at: string;
};

type EvidenceItem = {
  id: string;
  case_id: string;
  title: string;
  validation_status: string;
  created_at: string;
};

type EvidenceAssignment = {
  evidence_id: string;
  status: string;
};

type OfficerTask = {
  id: string;
  title: string;
  description: string;
  meta: string;
  icon: AppIconName;
  tone: "royal" | "gold" | "teal" | "red";
  actionLabel: string;
  onPress: () => void;
};

function formatStatus(status: CaseStatus) {
  switch (status) {
    case "under_review":
      return "Under review";
    case "awaiting_evidence":
      return "Awaiting evidence";
    case "awaiting_information":
      return "Awaiting information";
    case "investigating":
      return "Investigating";
    case "submitted":
      return "Submitted";
    case "assigned":
      return "Assigned";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toneStyles(tone: OfficerTask["tone"]) {
  switch (tone) {
    case "gold":
      return {
        box: styles.iconGold,
        color: colors.warning,
      };
    case "teal":
      return {
        box: styles.iconTeal,
        color: colors.teal[800],
      };
    case "red":
      return {
        box: styles.iconRed,
        color: colors.error,
      };
    case "royal":
    default:
      return {
        box: styles.iconRoyal,
        color: colors.royal[700],
      };
  }
}

export default function OfficerTasksScreen() {
  const router = useRouter();

  const [cases, setCases] = useState<OfficerCase[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [assignments, setAssignments] = useState<EvidenceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadTasks = useCallback(
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

        const { data: aal, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          setErrorMessage(aalError.message);
          return;
        }

        if (aal.currentLevel !== "aal2") {
          router.replace("/two-factor");
          return;
        }

        const { data: assignmentsData, error: assignmentsError } =
          await supabase
            .from("case_assignments")
            .select(
              `
                assigned_at,
                cases (
                  id,
                  case_reference,
                  title,
                  status,
                  priority,
                  updated_at
                )
              `,
            )
            .eq("assigned_officer_id", user.id)
            .eq("is_active", true)
            .order("assigned_at", { ascending: false });

        if (assignmentsError) {
          setErrorMessage(assignmentsError.message);
          return;
        }

        const nextCases = (assignmentsData ?? [])
          .map((row: any) => row.cases)
          .filter(Boolean) as OfficerCase[];

        setCases(nextCases);

        const caseIds = nextCases.map((caseItem) => caseItem.id);

        if (caseIds.length === 0) {
          setEvidence([]);
          setAssignments([]);
          return;
        }

        const [evidenceResult, assignmentResult] = await Promise.all([
          supabase
            .from("case_evidence")
            .select("id, case_id, title, validation_status, created_at")
            .in("case_id", caseIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("evidence_assignments")
            .select("evidence_id, status")
            .in("case_id", caseIds)
            .in("status", ["assigned", "under_review"]),
        ]);

        if (evidenceResult.error) {
          setErrorMessage(evidenceResult.error.message);
          return;
        }

        if (assignmentResult.error) {
          setErrorMessage(assignmentResult.error.message);
          return;
        }

        setEvidence((evidenceResult.data ?? []) as EvidenceItem[]);
        setAssignments((assignmentResult.data ?? []) as EvidenceAssignment[]);
      } catch (error) {
        console.error("LOAD OFFICER TASKS ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load officer tasks.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
      return undefined;
    }, [loadTasks]),
  );

  const tasks = useMemo<OfficerTask[]>(() => {
    const activeAssignmentEvidence = new Set(
      assignments.map((assignment) => assignment.evidence_id),
    );

    const pendingEvidence = evidence.filter(
      (item) =>
        item.validation_status === "pending" &&
        !activeAssignmentEvidence.has(item.id),
    );

    const reviewEvidence = evidence.filter(
      (item) =>
        item.validation_status === "pending" ||
        item.validation_status === "under_review",
    );

    const awaitingReporter = cases.filter(
      (caseItem) =>
        caseItem.status === "awaiting_information" ||
        caseItem.status === "awaiting_evidence",
    );

    const priorityCases = cases.filter(
      (caseItem) =>
        caseItem.priority === "high" || caseItem.priority === "urgent",
    );

    const nextTasks: OfficerTask[] = [];

    if (pendingEvidence.length > 0) {
      const first = pendingEvidence[0];

      nextTasks.push({
        id: "assign-evidence",
        title: "Assign evidence for validation",
        description: `${pendingEvidence.length} pending evidence item${
          pendingEvidence.length === 1 ? "" : "s"
        } need an Evidence Checker assignment.`,
        meta: `Next item: ${first.title}`,
        icon: "user-plus",
        tone: "royal",
        actionLabel: "Assign now",
        onPress: () =>
          router.push({
            pathname: "/officer/assign-evidence",
            params: {
              caseId: first.case_id,
              evidenceId: first.id,
            },
          }),
      });
    }

    if (reviewEvidence.length > 0) {
      nextTasks.push({
        id: "review-evidence",
        title: "Review case evidence",
        description:
          "Open submitted evidence, record officer findings and track validation status.",
        meta: `${reviewEvidence.length} active evidence item${
          reviewEvidence.length === 1 ? "" : "s"
        }`,
        icon: "file-search",
        tone: "teal",
        actionLabel: "Open files",
        onPress: () => router.push("/officer/evidence"),
      });
    }

    if (awaitingReporter.length > 0) {
      const first = awaitingReporter[0];

      nextTasks.push({
        id: "awaiting-reporter",
        title: "Follow up with reporter",
        description:
          "Cases waiting on reporter information or supporting evidence should be monitored.",
        meta: `${first.case_reference} · ${formatStatus(first.status)}`,
        icon: "message-square",
        tone: "gold",
        actionLabel: "Open case",
        onPress: () =>
          router.push({
            pathname: "/officer/case-details",
            params: {
              id: first.id,
            },
          }),
      });
    }

    if (priorityCases.length > 0) {
      const first = priorityCases[0];

      nextTasks.push({
        id: "priority-cases",
        title: "Review high-priority cases",
        description:
          "High and urgent cases are surfaced first for active case-management action.",
        meta: `${priorityCases.length} priority case${
          priorityCases.length === 1 ? "" : "s"
        } · latest ${formatDateTime(first.updated_at)}`,
        icon: "alert-triangle",
        tone: "red",
        actionLabel: "Open queue",
        onPress: () => router.push("/officer/cases"),
      });
    }

    if (nextTasks.length === 0 && cases.length > 0) {
      nextTasks.push({
        id: "workspace-check",
        title: "Continue investigation workspace",
        description:
          "No urgent task is waiting. Continue reviewing assigned cases and recording progress.",
        meta: `${cases.length} active assigned case${
          cases.length === 1 ? "" : "s"
        }`,
        icon: "list-checks",
        tone: "royal",
        actionLabel: "Open cases",
        onPress: () => router.push("/officer/cases"),
      });
    }

    return nextTasks;
  }, [assignments, cases, evidence, router]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadTasks(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />
        <Text style={styles.loadingText}>Loading investigation tasks...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <AppIcon
              name="chevron-left"
              size={iconSizes.headerBack}
              color={colors.textInverse}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>Case management</Text>
            <Text style={styles.headerTitle}>Investigation tasks</Text>
          </View>
        </View>

        <Text style={styles.headerNotice}>
          Sprint 3 evidence review actions stay with the Case Officer: assign
          pending evidence, review findings and follow up on reporter requests.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.royal[700]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="Assigned" value={cases.length} tone="royal" />
          <SummaryCard label="Evidence" value={evidence.length} tone="teal" />
          <SummaryCard label="Open tasks" value={tasks.length} tone="gold" />
        </View>

        {errorMessage !== "" ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load tasks</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              onPress={() => void loadTasks()}
              accessibilityRole="button"
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today</Text>
          <Text style={styles.sectionCount}>{tasks.length} active</Text>
        </View>

        {errorMessage === "" && tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="check-circle" size={26} color={colors.teal[700]} />
            <Text style={styles.emptyTitle}>No active tasks</Text>
            <Text style={styles.emptyText}>
              There are no assigned cases or evidence actions waiting on this
              officer account.
            </Text>
          </View>
        ) : null}

        {errorMessage === ""
          ? tasks.map((task) => {
              const tone = toneStyles(task.tone);

              return (
                <Pressable
                  key={task.id}
                  onPress={task.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.taskCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.taskIconBox, tone.box]}>
                    <AppIcon name={task.icon} size={18} color={tone.color} />
                  </View>

                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskDescription}>
                      {task.description}
                    </Text>
                    <Text style={styles.taskMeta}>{task.meta}</Text>
                  </View>

                  <View style={styles.taskAction}>
                    <Text style={styles.taskActionText}>
                      {task.actionLabel}
                    </Text>
                    <AppIcon
                      name="chevron-right"
                      size={17}
                      color={colors.royal[700]}
                    />
                  </View>
                </Pressable>
              );
            })
          : null}

        <View style={styles.securityNotice}>
          <AppIcon name="lock" size={15} color={colors.teal[800]} />
          <Text style={styles.securityText}>
            Tasks are generated only from cases currently assigned to your
            authenticated Case Officer account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "royal" | "teal" | "gold";
}) {
  return (
    <View style={styles.summaryCard}>
      <Text
        style={[
          styles.summaryValue,
          tone === "teal" && styles.summaryTeal,
          tone === "gold" && styles.summaryGold,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 26,
    backgroundColor: colors.navy[900],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  headerText: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[300],
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "800",
    color: colors.textInverse,
  },
  headerNotice: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[100],
    backgroundColor: colors.navy[800],
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: -13,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    minHeight: 76,
    justifyContent: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  summaryValue: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.royal[700],
  },
  summaryTeal: {
    color: colors.teal[700],
  },
  summaryGold: {
    color: colors.warning,
  },
  summaryLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  sectionHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.royal[700],
  },
  taskCard: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.72,
  },
  taskIconBox: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  iconRoyal: {
    backgroundColor: colors.royal[50],
  },
  iconGold: {
    backgroundColor: colors.gold[50],
  },
  iconTeal: {
    backgroundColor: colors.teal[50],
  },
  iconRed: {
    backgroundColor: "#FFF0EF",
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy[800],
  },
  taskDescription: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  taskMeta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[700],
  },
  taskAction: {
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 2,
  },
  taskActionText: {
    maxWidth: 70,
    textAlign: "right",
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.royal[700],
  },
  errorCard: {
    marginBottom: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#F2C8C4",
    borderRadius: 16,
    backgroundColor: "#FFF7F6",
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.error,
  },
  errorText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    marginTop: 12,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.error,
  },
  retryText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.textInverse,
  },
  emptyCard: {
    alignItems: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy[800],
  },
  emptyText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 16,
    backgroundColor: colors.teal[50],
  },
  securityText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
