import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

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

type DashboardCase = {
  id: string;
  case_reference: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  updated_at: string;
};

type EvidenceReview = {
  id: string;
  review_state: "reviewed" | "follow_up_required";
};

type EvidenceRecord = {
  id: string;
  case_id: string;
  officer_evidence_reviews: EvidenceReview[];
};

type StatusHistoryItem = {
  id: string;
  case_id: string;
  old_status: CaseStatus | null;
  new_status: CaseStatus;
  changed_at: string;
};

type DashboardStats = {
  assigned: number;
  investigating: number;
  awaitingEvidence: number;
  urgent: number;
  evidenceToReview: number;
  followUps: number;
};

const INITIAL_STATS: DashboardStats = {
  assigned: 0,
  investigating: 0,
  awaitingEvidence: 0,
  urgent: 0,
  evidenceToReview: 0,
  followUps: 0,
};

export default function OfficerDashboardScreen() {
  const router = useRouter();

  const [officerName, setOfficerName] = useState("Case Officer");
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [recentUpdates, setRecentUpdates] = useState<StatusHistoryItem[]>([]);
  const [caseMap, setCaseMap] = useState<Record<string, DashboardCase>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(
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
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();

          Alert.alert(
            "Profile error",
            "JusticeNow could not load your staff profile.",
          );

          router.replace("/login");
          return;
        }

        if (profile.role !== "case_officer") {
          await supabase.auth.signOut();

          Alert.alert(
            "Access denied",
            "This workspace is restricted to authorized Case Officers.",
          );

          router.replace("/login");
          return;
        }

        setOfficerName(profile.full_name || "Case Officer");

        const mfa = await hasCompletedStaffMfa();

        if (mfa.error) {
          setErrorMessage(mfa.error.message);
          return;
        }

        if (!mfa.verified) {
          router.replace("/two-factor");
          return;
        }

        const { data: assignments, error: assignmentsError } = await supabase
          .from("case_assignments")
          .select("case_id")
          .eq("assigned_officer_id", user.id)
          .eq("is_active", true);

        if (assignmentsError) {
          setErrorMessage(assignmentsError.message);
          return;
        }

        const caseIds = [
          ...new Set(
            (assignments ?? []).map((assignment) => assignment.case_id),
          ),
        ];

        if (caseIds.length === 0) {
          setStats(INITIAL_STATS);
          setRecentUpdates([]);
          setCaseMap({});
          return;
        }

        const { data: casesData, error: casesError } = await supabase
          .from("cases")
          .select(
            `
                id,
                case_reference,
                title,
                status,
                priority,
                updated_at
              `,
          )
          .in("id", caseIds);

        if (casesError) {
          setErrorMessage(casesError.message);
          return;
        }

        const officerCases = (casesData ?? []) as DashboardCase[];

        const nextCaseMap: Record<string, DashboardCase> = {};

        officerCases.forEach((caseItem) => {
          nextCaseMap[caseItem.id] = caseItem;
        });

        setCaseMap(nextCaseMap);

        const { data: evidenceData, error: evidenceError } = await supabase
          .from("case_evidence")
          .select(
            `
                id,
                case_id,
                officer_evidence_reviews (
                  id,
                  review_state
                )
              `,
          )
          .in("case_id", caseIds);

        if (evidenceError) {
          console.error("DASHBOARD EVIDENCE ERROR:", evidenceError);
        }

        const evidenceRecords = (evidenceData ??
          []) as unknown as EvidenceRecord[];

        const assignedCount = officerCases.length;

        const investigatingCount = officerCases.filter(
          (caseItem) =>
            caseItem.status === "investigating" ||
            caseItem.status === "awaiting_information",
        ).length;

        const awaitingEvidenceCount = officerCases.filter(
          (caseItem) => caseItem.status === "awaiting_evidence",
        ).length;

        const urgentCount = officerCases.filter(
          (caseItem) => caseItem.priority === "urgent",
        ).length;

        const evidenceToReviewCount = evidenceRecords.filter(
          (evidenceItem) =>
            !evidenceItem.officer_evidence_reviews ||
            evidenceItem.officer_evidence_reviews.length === 0,
        ).length;

        const followUpCount = evidenceRecords.filter((evidenceItem) =>
          evidenceItem.officer_evidence_reviews?.some(
            (review) => review.review_state === "follow_up_required",
          ),
        ).length;

        setStats({
          assigned: assignedCount,
          investigating: investigatingCount,
          awaitingEvidence: awaitingEvidenceCount,
          urgent: urgentCount,
          evidenceToReview: evidenceToReviewCount,
          followUps: followUpCount,
        });

        const { data: historyData, error: historyError } = await supabase
          .from("case_status_history")
          .select(
            `
                id,
                case_id,
                old_status,
                new_status,
                changed_at
              `,
          )
          .in("case_id", caseIds)
          .order("changed_at", {
            ascending: false,
          })
          .limit(5);

        if (historyError) {
          console.error("DASHBOARD HISTORY ERROR:", historyError);
          setRecentUpdates([]);
        } else {
          setRecentUpdates((historyData ?? []) as StatusHistoryItem[]);
        }
      } catch (error) {
        console.error("LOAD OFFICER DASHBOARD ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load the Case Officer dashboard.",
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
      void loadDashboard();
      return undefined;
    }, [loadDashboard]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void loadDashboard(false);
  };

  const priorityQueue = useMemo(() => {
    const priorityWeight: Record<CasePriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return Object.values(caseMap)
      .sort((left, right) => {
        const priorityDifference =
          priorityWeight[right.priority] - priorityWeight[left.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return (
          new Date(right.updated_at).getTime() -
          new Date(left.updated_at).getTime()
        );
      })
      .slice(0, 4);
  }, [caseMap]);

  const completeSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      if (Platform.OS === "web") {
        window.alert(`Unable to sign out: ${error.message}`);
      } else {
        Alert.alert("Unable to sign out", error.message);
      }

      return;
    }

    router.replace("/login");
  };

  const signOut = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Do you want to sign out of the JusticeNow staff workspace?",
      );

      if (confirmed) {
        void completeSignOut();
      }

      return;
    }

    Alert.alert(
      "Sign out",
      "Do you want to sign out of the JusticeNow staff workspace?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void completeSignOut(),
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>
          Loading Case Officer workspace...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <AppIcon name="scale" size={18} color={colors.textInverse} />
          </View>

          <View>
            <Text style={styles.workspaceLabel}>Case Officer workspace</Text>

            <Text style={styles.brandName}>{officerName}</Text>
          </View>
        </View>

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
          ]}
        >
          <AppIcon name="log-out" size={15} color={colors.textInverse} />

          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>Today’s focus</Text>

          <Text style={styles.welcomeTitle}>Review, assign and follow up</Text>

          <Text style={styles.welcomeText}>
            {stats.urgent} urgent case{stats.urgent === 1 ? " is" : "s are"}{" "}
            active and {stats.evidenceToReview} evidence item
            {stats.evidenceToReview === 1 ? "" : "s"} need officer attention.
            Work through the queue from highest risk to routine follow-up.
          </Text>
        </View>

        {errorMessage !== "" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Dashboard update failed</Text>

            <Text style={styles.errorText}>{errorMessage}</Text>

            <Pressable
              onPress={() => void loadDashboard()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard
            icon="folder-open"
            value={stats.assigned}
            label="Assigned Cases"
            tone="blue"
          />

          <StatCard
            icon="search"
            value={stats.investigating}
            label="Investigating"
            tone="teal"
          />

          <StatCard
            icon="file-up"
            value={stats.awaitingEvidence}
            label="Awaiting Evidence"
            tone="gold"
          />

          <StatCard
            icon="alert-triangle"
            value={stats.urgent}
            label="Urgent Cases"
            tone="red"
          />

          <StatCard
            icon="file-text"
            value={stats.evidenceToReview}
            label="Evidence to Review"
            tone="blue"
          />

          <StatCard
            icon="refresh-cw"
            value={stats.followUps}
            label="Follow-ups"
            tone="gold"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Priority case queue</Text>

          <Pressable
            onPress={() => router.push("/officer/cases")}
            accessibilityRole="button"
          >
            <Text style={styles.refreshText}>Open queue</Text>
          </Pressable>
        </View>

        {priorityQueue.length === 0 ? (
          <View style={styles.emptyActivity}>
            <AppIcon name="folder-open" size={22} color={colors.navy[700]} />

            <Text style={styles.emptyActivityTitle}>No active cases</Text>

            <Text style={styles.emptyActivityText}>
              Assigned cases will appear here once your queue is updated.
            </Text>
          </View>
        ) : (
          priorityQueue.map((caseItem) => (
            <PriorityCaseCard
              key={caseItem.id}
              caseItem={caseItem}
              onPress={() =>
                router.push({
                  pathname: "/officer/case-details",
                  params: {
                    id: caseItem.id,
                  },
                })
              }
            />
          ))
        )}

        <Text style={styles.actionsSectionTitle}>Quick actions</Text>

        <View style={styles.actionGrid}>
          <ActionCard
            icon="folder-open"
            title="View new cases"
            description="Open your assigned case queue."
            onPress={() => router.push("/officer/cases")}
            badge={stats.assigned}
          />

          <ActionCard
            icon="user-plus"
            title="My assigned cases"
            description="Continue active investigations."
            onPress={() => router.push("/officer/cases")}
          />

          <ActionCard
            icon="message-square"
            title="Pending responses"
            description="Check reporter communication."
            onPress={() => router.push("/officer/messages")}
          />

          <ActionCard
            icon="list-checks"
            title="Investigation tasks"
            description="Track today’s officer tasks."
            onPress={() => router.push("/officer/tasks")}
            badge={stats.evidenceToReview}
          />
        </View>

        <View style={styles.activityHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent case activity</Text>

            <Text style={styles.sectionSubtitle}>
              Latest status changes from assigned cases
            </Text>
          </View>
        </View>

        {recentUpdates.length === 0 ? (
          <View style={styles.emptyActivity}>
            <AppIcon name="history" size={22} color={colors.navy[700]} />

            <Text style={styles.emptyActivityTitle}>No recent updates</Text>

            <Text style={styles.emptyActivityText}>
              Status changes from your assigned cases will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.activityCard}>
            {recentUpdates.map((update, index) => {
              const caseItem = caseMap[update.case_id];

              return (
                <View key={update.id}>
                  <Pressable
                    disabled={!caseItem}
                    onPress={() => {
                      if (!caseItem) {
                        return;
                      }

                      router.push({
                        pathname: "/officer/case-details",
                        params: {
                          id: caseItem.id,
                        },
                      });
                    }}
                    style={({ pressed }) => [
                      styles.activityRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.activityDotContainer}>
                      <View style={styles.activityDot} />
                    </View>

                    <View style={styles.activityContent}>
                      <Text style={styles.activityReference}>
                        {caseItem?.case_reference ?? "Case"}
                      </Text>

                      <Text style={styles.activityTitle}>
                        {formatStatus(update.old_status)} →{" "}
                        {formatStatus(update.new_status)}
                      </Text>

                      <Text style={styles.activityDate}>
                        {formatDateTime(update.changed_at)}
                      </Text>
                    </View>

                    <AppIcon name="chevron-right" size={24} color={colors.royal[700]} />
                  </Pressable>

                  {index < recentUpdates.length - 1 && (
                    <View style={styles.activityDivider} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.securityCard}>
          <AppIcon name="lock" size={16} color={colors.teal[800]} />

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Protected staff workspace</Text>

            <Text style={styles.securityText}>
              JusticeNow restricts this workspace to your authenticated Case
              Officer account and actively assigned cases.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: AppIconName;
  value: number;
  label: string;
  tone: "blue" | "teal" | "gold" | "red";
}) {
  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIconBox,
          tone === "blue" && styles.statBlue,
          tone === "teal" && styles.statTeal,
          tone === "gold" && styles.statGold,
          tone === "red" && styles.statRed,
        ]}
      >
        <AppIcon name={icon} size={16} color={colors.navy[700]} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onPress,
  badge,
}: {
  icon: AppIconName;
  title: string;
  description: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
    >
      <View style={styles.actionIconBox}>
        <AppIcon name={icon} size={18} color={colors.royal[700]} />
      </View>

      <View style={styles.actionContent}>
        <View style={styles.actionTitleRow}>
          <Text style={styles.actionTitle}>{title}</Text>

          {badge !== undefined && badge > 0 && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{badge}</Text>
            </View>
          )}
        </View>

        <Text style={styles.actionDescription}>{description}</Text>
      </View>

      <AppIcon name="chevron-right" size={26} color={colors.royal[700]} />
    </Pressable>
  );
}

function PriorityCaseCard({
  caseItem,
  onPress,
}: {
  caseItem: DashboardCase;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${caseItem.case_reference}`}
      style={({ pressed }) => [
        styles.priorityCaseCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.priorityCaseTop}>
        <View style={styles.priorityCaseContent}>
          <Text style={styles.priorityReference}>
            {caseItem.case_reference}
          </Text>

          <Text numberOfLines={1} style={styles.priorityTitle}>
            {caseItem.title}
          </Text>

          <Text style={styles.priorityMeta}>
            Updated {formatDateTime(caseItem.updated_at)}
          </Text>
        </View>

        <AppIcon name="chevron-right" size={18} color={colors.navy[300]} />
      </View>

      <View style={styles.priorityBadgeRow}>
        <View
          style={[
            styles.priorityBadge,
            caseItem.priority === "urgent" && styles.priorityUrgent,
            caseItem.priority === "high" && styles.priorityHigh,
          ]}
        >
          <Text
            style={[
              styles.priorityBadgeText,
              caseItem.priority === "urgent" && styles.priorityUrgentText,
            ]}
          >
            {caseItem.priority} priority
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>
            {formatStatus(caseItem.status)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function formatStatus(status: CaseStatus | null) {
  if (!status) {
    return "Unknown";
  }

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
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.navy[900],
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.royal[600],
  },
  brandName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textInverse,
  },
  workspaceLabel: {
    marginBottom: 2,
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[300],
  },
  signOutButton: {
    minHeight: 38,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    backgroundColor: colors.navy[800],
  },
  signOutText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textInverse,
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    padding: 16,
    paddingBottom: 42,
  },
  welcomeCard: {
    marginTop: -28,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.navy[800],
  },
  welcomeLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#AFC5DE",
  },
  welcomeTitle: {
    marginTop: 6,
    fontSize: 21,
    fontWeight: "600",
    color: colors.textInverse,
  },
  welcomeText: {
    marginTop: 7,
    maxWidth: 320,
    fontSize: 12,
    lineHeight: 18,
    color: "#DCE5EF",
  },
  sectionHeader: {
    marginTop: 23,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy[800],
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  refreshText: {
    padding: 5,
    fontSize: 11,
    fontWeight: "600",
    color: colors.royal[700],
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 92,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  statIconBox: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  statBlue: {
    backgroundColor: colors.royal[50],
  },
  statTeal: {
    backgroundColor: colors.teal[50],
  },
  statGold: {
    backgroundColor: colors.gold[50],
  },
  statRed: {
    backgroundColor: "#FFF0EF",
  },
  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "600",
    color: colors.navy[800],
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  actionsSectionTitle: {
    marginTop: 25,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: colors.textSecondary,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 92,
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  actionIconBox: {
    width: 34,
    height: 34,
    marginBottom: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "transparent",
  },
  actionContent: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  actionDescription: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  priorityCaseCard: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  priorityCaseTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  priorityCaseContent: {
    flex: 1,
    minWidth: 0,
  },
  priorityReference: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.royal[700],
  },
  priorityTitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  priorityMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  priorityBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.navy[50],
  },
  priorityHigh: {
    borderColor: colors.gold[100],
    backgroundColor: colors.gold[50],
  },
  priorityUrgent: {
    borderColor: "#F2C8C4",
    backgroundColor: "#FFF0EF",
  },
  priorityBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    textTransform: "capitalize",
    color: colors.navy[700],
  },
  priorityUrgentText: {
    color: colors.error,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 9,
    backgroundColor: colors.royal[50],
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
  actionBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.royal[700],
  },
  actionBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textInverse,
  },
  activityHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  activityCard: {
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  activityRow: {
    minHeight: 75,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  activityDotContainer: {
    width: 25,
    alignItems: "flex-start",
  },
  activityDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.royal[600],
  },
  activityContent: {
    flex: 1,
  },
  activityReference: {
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
  activityTitle: {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  activityDate: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.textSoft,
  },
  activityDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyActivity: {
    alignItems: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  emptyActivityTitle: {
    marginTop: 7,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  emptyActivityText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  securityCard: {
    marginTop: 18,
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.teal[800],
  },
  securityText: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  errorCard: {
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 13,
    backgroundColor: "#FFF2F1",
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
  },
  errorText: {
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.error,
  },
  retryText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textInverse,
  },
});
