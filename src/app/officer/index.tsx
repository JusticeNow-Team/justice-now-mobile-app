import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

  const [officerName, setOfficerName] =
    useState("Case Officer");
  const [stats, setStats] =
    useState<DashboardStats>(INITIAL_STATS);
  const [recentUpdates, setRecentUpdates] = useState<
    StatusHistoryItem[]
  >([]);
  const [caseMap, setCaseMap] = useState<
    Record<string, DashboardCase>
  >({});
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

        const { data: profile, error: profileError } =
          await supabase
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

        const { data: assignments, error: assignmentsError } =
          await supabase
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
            (assignments ?? []).map(
              (assignment) => assignment.case_id,
            ),
          ),
        ];

        if (caseIds.length === 0) {
          setStats(INITIAL_STATS);
          setRecentUpdates([]);
          setCaseMap({});
          return;
        }

        const { data: casesData, error: casesError } =
          await supabase
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

        const officerCases =
          (casesData ?? []) as DashboardCase[];

        const nextCaseMap: Record<string, DashboardCase> = {};

        officerCases.forEach((caseItem) => {
          nextCaseMap[caseItem.id] = caseItem;
        });

        setCaseMap(nextCaseMap);

        const { data: evidenceData, error: evidenceError } =
          await supabase
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
          console.error(
            "DASHBOARD EVIDENCE ERROR:",
            evidenceError,
          );
        }

        const evidenceRecords =
          (evidenceData ?? []) as unknown as EvidenceRecord[];

        const assignedCount = officerCases.length;

        const investigatingCount = officerCases.filter(
          (caseItem) =>
            caseItem.status === "investigating" ||
            caseItem.status === "awaiting_information",
        ).length;

        const awaitingEvidenceCount = officerCases.filter(
          (caseItem) =>
            caseItem.status === "awaiting_evidence",
        ).length;

        const urgentCount = officerCases.filter(
          (caseItem) => caseItem.priority === "urgent",
        ).length;

        const evidenceToReviewCount = evidenceRecords.filter(
          (evidenceItem) =>
            !evidenceItem.officer_evidence_reviews ||
            evidenceItem.officer_evidence_reviews.length === 0,
        ).length;

        const followUpCount = evidenceRecords.filter(
          (evidenceItem) =>
            evidenceItem.officer_evidence_reviews?.some(
              (review) =>
                review.review_state === "follow_up_required",
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

        const { data: historyData, error: historyError } =
          await supabase
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
          console.error(
            "DASHBOARD HISTORY ERROR:",
            historyError,
          );
          setRecentUpdates([]);
        } else {
          setRecentUpdates(
            (historyData ?? []) as StatusHistoryItem[],
          );
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

  const signOut = () => {
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
          onPress: async () => {
            const { error } =
              await supabase.auth.signOut();

            if (error) {
              Alert.alert(
                "Unable to sign out",
                error.message,
              );
              return;
            }

            router.replace("/login");
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={colors.royal[700]}
        />

        <Text style={styles.loadingText}>
          Loading Case Officer workspace...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>JusticeNow</Text>

          <Text style={styles.workspaceLabel}>
            Case Officer Workspace
          </Text>
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
          <Text style={styles.welcomeLabel}>CASE OFFICER</Text>

          <Text style={styles.welcomeTitle}>
            Welcome, {officerName}
          </Text>

          <Text style={styles.welcomeText}>
            Review assigned cases, examine evidence and record
            investigation progress securely.
          </Text>
        </View>

        {errorMessage !== "" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Dashboard update failed
            </Text>

            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <Pressable
              onPress={() => void loadDashboard()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Case overview
            </Text>

            <Text style={styles.sectionSubtitle}>
              Live data from your assigned investigations
            </Text>
          </View>

          <Pressable
            onPress={handleRefresh}
            accessibilityRole="button"
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="📁"
            value={stats.assigned}
            label="Assigned Cases"
            tone="blue"
          />

          <StatCard
            icon="🔎"
            value={stats.investigating}
            label="Investigating"
            tone="teal"
          />

          <StatCard
            icon="📎"
            value={stats.awaitingEvidence}
            label="Awaiting Evidence"
            tone="gold"
          />

          <StatCard
            icon="⚠️"
            value={stats.urgent}
            label="Urgent Cases"
            tone="red"
          />

          <StatCard
            icon="📄"
            value={stats.evidenceToReview}
            label="Evidence to Review"
            tone="blue"
          />

          <StatCard
            icon="↻"
            value={stats.followUps}
            label="Follow-ups"
            tone="gold"
          />
        </View>

        <Text style={styles.actionsSectionTitle}>
          Quick actions
        </Text>

        <ActionCard
          icon="📁"
          title="Assigned Cases"
          description="Review cases currently assigned to your officer account."
          onPress={() => router.push("/officer/cases")}
          badge={stats.assigned}
        />

        <ActionCard
          icon="🔎"
          title="Evidence Review"
          description="View case evidence and record investigation findings."
          onPress={() => router.push("/officer/evidence")}
          badge={stats.evidenceToReview}
        />

        <ActionCard
          icon="📝"
          title="Case Updates"
          description="Review the latest investigation status changes."
          onPress={() =>
            Alert.alert(
              "Recent Case Updates",
              "Your latest case updates are displayed below on this dashboard.",
            )
          }
        />

        <ActionCard
          icon="🔔"
          title="Notifications"
          description="Review case assignments, evidence activity and officer alerts."
          onPress={() =>
            router.push("/officer/notifications")
          }
        />

        <View style={styles.activityHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Recent case activity
            </Text>

            <Text style={styles.sectionSubtitle}>
              Latest status changes from assigned cases
            </Text>
          </View>
        </View>

        {recentUpdates.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Text style={styles.emptyActivityIcon}>🕘</Text>

            <Text style={styles.emptyActivityTitle}>
              No recent updates
            </Text>

            <Text style={styles.emptyActivityText}>
              Status changes from your assigned cases will appear
              here.
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

                    <Text style={styles.activityArrow}>›</Text>
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
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Protected staff workspace
            </Text>

            <Text style={styles.securityText}>
              JusticeNow restricts this workspace to your
              authenticated Case Officer account and actively
              assigned cases.
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
  icon: string;
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
        <Text style={styles.statIcon}>{icon}</Text>
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
  icon: string;
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
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.actionIconBox}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>

      <View style={styles.actionContent}>
        <View style={styles.actionTitleRow}>
          <Text style={styles.actionTitle}>{title}</Text>

          {badge !== undefined && badge > 0 && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>
                {badge}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.actionDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.actionArrow}>›</Text>
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
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brandName: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.navy[800],
  },
  workspaceLabel: {
    marginTop: 2,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  signOutButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  signOutText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    padding: 16,
    paddingBottom: 42,
  },
  welcomeCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.navy[800],
  },
  welcomeLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#AFC5DE",
  },
  welcomeTitle: {
    marginTop: 6,
    fontSize: 21,
    fontWeight: "800",
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
    fontWeight: "700",
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
    minHeight: 126,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  statIconBox: {
    width: 38,
    height: 38,
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
  statIcon: {
    fontSize: 16,
  },
  statValue: {
    marginTop: 10,
    fontSize: 23,
    fontWeight: "800",
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },
  actionCard: {
    minHeight: 83,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },
  actionIcon: {
    fontSize: 18,
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
    fontWeight: "700",
    color: colors.navy[800],
  },
  actionDescription: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  actionArrow: {
    marginLeft: 8,
    fontSize: 26,
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
    fontWeight: "700",
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
    fontWeight: "700",
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
  activityArrow: {
    fontSize: 24,
    color: colors.royal[700],
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
  emptyActivityIcon: {
    fontSize: 22,
  },
  emptyActivityTitle: {
    marginTop: 7,
    fontSize: 12.5,
    fontWeight: "700",
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
  securityIcon: {
    marginRight: 9,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 11.5,
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
    color: colors.textInverse,
  },
});