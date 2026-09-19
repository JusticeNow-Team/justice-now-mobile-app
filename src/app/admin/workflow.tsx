import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth";
import { normalizeRole } from "../../auth/roles";
import { AppIcon } from "../../components/AppIcon";
import { colors } from "../../theme";
import {
  getWorkflowDashboardMetrics,
  WorkflowDashboardMetrics,
  WorkflowDelayItem,
} from "../../workflow";

function formatTimestamp(isoString?: string): string {
  if (!isoString) return "Just now";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getToneStyles(tone: "info" | "warning" | "success" | "neutral" | "danger") {
  switch (tone) {
    case "success":
      return {
        bg: "#E8F8F0",
        border: "#B2E7CC",
        text: colors.success,
        badgeBg: "#D1FAE5",
      };
    case "warning":
      return {
        bg: "#FEF7EC",
        border: "#FCD8A5",
        text: "#C05621",
        badgeBg: "#FEF3C7",
      };
    case "danger":
      return {
        bg: "#FDE8E8",
        border: "#F8B4B4",
        text: colors.error,
        badgeBg: "#FEE2E2",
      };
    case "info":
      return {
        bg: "#EBF5FB",
        border: "#BCE0F7",
        text: colors.royal[700],
        badgeBg: "#E0F2FE",
      };
    default:
      return {
        bg: "#F4F6F9",
        border: "#E2E8F0",
        text: colors.textSecondary,
        badgeBg: "#EDF2F7",
      };
  }
}

export default function AdminWorkflowScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const userRole = normalizeRole(user?.role);
  const isAuthorized = userRole === "system_admin";

  const [metrics, setMetrics] = useState<WorkflowDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadMetrics = useCallback(
    async (isManualRefresh = false) => {
      if (!isAuthorized) {
        setLoading(false);
        return;
      }

      try {
        if (isManualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setLoadError("");

        const result = await getWorkflowDashboardMetrics({}, user?.role || "system_admin");
        setMetrics(result);
      } catch (err: any) {
        console.error("Workflow metrics load error:", err);
        setLoadError(err?.message || "Unable to compute workflow metrics.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthorized, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMetrics();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMetrics]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        {/* Navigation & Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Administration hub"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            onPress={() => router.push("/admin")}
          >
            <AppIcon name="chevron-left" size={22} color={colors.navy[800]} />
          </Pressable>

          <View style={styles.headerIcon}>
            <AppIcon name="activity" size={22} color={colors.royal[700]} />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Workflow Activity Monitoring</Text>
            <Text style={styles.headerSubtitle}>
              Live case pipeline, evidence verification, and SLA delay tracker
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh workflow metrics"
            disabled={loading || refreshing}
            style={({ pressed }) => [
              styles.refreshButton,
              (loading || refreshing) && styles.disabledBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => void loadMetrics(true)}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.royal[700]} />
            ) : (
              <AppIcon name="refresh-cw" size={17} color={colors.royal[700]} />
            )}
          </Pressable>
        </View>

        {/* Security Guard Notice (AC 6) */}
        {!isAuthorized ? (
          <View style={styles.unauthorizedNotice}>
            <AppIcon name="shield-alert" size={24} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.unauthorizedTitle}>Access Denied (AC 6)</Text>
              <Text style={styles.unauthorizedText}>
                Workflow Activity Dashboard is restricted to authorized System Administrators.
                Current role:{" "}
                <Text style={{ fontWeight: "700" }}>{user?.role || "anonymous"}</Text>.
              </Text>
            </View>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Computing live workflow metrics...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorContainer}>
            <AppIcon name="alert-triangle" size={28} color={colors.error} />
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadMetrics()}>
              <Text style={styles.retryBtnText}>Retry Calculation</Text>
            </Pressable>
          </View>
        ) : !metrics ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No metrics available.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Live Data Badge & Calculation Timestamp (AC 5) */}
            <View style={styles.liveMetaRow}>
              <View style={styles.livePill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePillText}>
                  LIVE SYSTEM DATA · Updated {formatTimestamp(metrics.computedAt)}
                </Text>
              </View>
              <Text style={styles.sourceTag}>
                Source: {metrics.dataSource === "live" ? "Supabase DB" : "In-Memory Engine"}
              </Text>
            </View>

            {/* 4 PRIMARY METRIC HERO CARDS (AC 1–4) */}
            <View style={styles.heroMetricsGrid}>
              {/* AC 1: Total Active Cases */}
              <View style={[styles.heroCard, { borderColor: "#BCE0F7", backgroundColor: "#F4FAFF" }]}>
                <View style={styles.heroCardHeader}>
                  <Text style={styles.heroCardLabel}>TOTAL ACTIVE CASES</Text>
                  <View style={[styles.heroIconBadge, { backgroundColor: "#E0F2FE" }]}>
                    <AppIcon name="document" size={17} color={colors.royal[700]} />
                  </View>
                </View>
                <Text style={[styles.heroCardValue, { color: colors.royal[800] }]}>
                  {metrics.totalActiveCases}
                </Text>
                <Text style={styles.heroCardFooter}>
                  {metrics.totalCasesCount > 0
                    ? `${Math.round((metrics.totalActiveCases / metrics.totalCasesCount) * 100)}% of ${metrics.totalCasesCount} registered cases`
                    : "Non-terminal workflow cases"}
                </Text>
              </View>

              {/* AC 2: Cases Awaiting Initial Review */}
              <View style={[styles.heroCard, { borderColor: "#FCD8A5", backgroundColor: "#FFFBF2" }]}>
                <View style={styles.heroCardHeader}>
                  <Text style={styles.heroCardLabel}>AWAITING INITIAL REVIEW</Text>
                  <View style={[styles.heroIconBadge, { backgroundColor: "#FEF3C7" }]}>
                    <AppIcon name="clock" size={17} color="#D97706" />
                  </View>
                </View>
                <Text style={[styles.heroCardValue, { color: "#B45309" }]}>
                  {metrics.casesAwaitingInitialReview}
                </Text>
                <Text style={styles.heroCardFooter}>
                  Submitted & Under Review queue
                </Text>
              </View>

              {/* AC 3: Evidence Awaiting Verification */}
              <View style={[styles.heroCard, { borderColor: "#FCD8A5", backgroundColor: "#FFFBF2" }]}>
                <View style={styles.heroCardHeader}>
                  <Text style={styles.heroCardLabel}>EVIDENCE AWAITING VERIFICATION</Text>
                  <View style={[styles.heroIconBadge, { backgroundColor: "#FEF3C7" }]}>
                    <AppIcon name="file-search" size={17} color="#D97706" />
                  </View>
                </View>
                <Text style={[styles.heroCardValue, { color: "#B45309" }]}>
                  {metrics.evidenceAwaitingVerification}
                </Text>
                <Text style={styles.heroCardFooter}>
                  Pending Review & Under Verification
                </Text>
              </View>

              {/* AC 4: Completed Verification Count */}
              <View style={[styles.heroCard, { borderColor: "#B2E7CC", backgroundColor: "#F2FBF6" }]}>
                <View style={styles.heroCardHeader}>
                  <Text style={styles.heroCardLabel}>COMPLETED VERIFICATIONS</Text>
                  <View style={[styles.heroIconBadge, { backgroundColor: "#D1FAE5" }]}>
                    <AppIcon name="shield-check" size={17} color={colors.success} />
                  </View>
                </View>
                <Text style={[styles.heroCardValue, { color: colors.success }]}>
                  {metrics.completedVerificationCount}
                </Text>
                <Text style={styles.heroCardFooter}>
                  Approved & Validated + Rejected files
                </Text>
              </View>
            </View>

            {/* BOTTLENECK & UNUSUAL DELAY ALERTS (JN-287 & JN-292) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <AppIcon
                    name={metrics.delayAlerts.length > 0 ? "shield-alert" : "shield-check"}
                    size={18}
                    color={metrics.delayAlerts.length > 0 ? colors.warning : colors.success}
                  />
                  <Text style={styles.sectionHeaderTitle}>SLA BOTTLENECK & DELAY ALERTS</Text>
                </View>
                <View
                  style={[
                    styles.alertCountBadge,
                    metrics.delayAlerts.length > 0 ? styles.alertCountWarn : styles.alertCountOk,
                  ]}
                >
                  <Text
                    style={[
                      styles.alertCountText,
                      metrics.delayAlerts.length > 0 ? styles.alertTextWarn : styles.alertTextOk,
                    ]}
                  >
                    {metrics.delayAlerts.length} Overdue Items
                  </Text>
                </View>
              </View>

              {metrics.delayAlerts.length > 0 ? (
                <View style={styles.alertsList}>
                  {metrics.delayAlerts.map((alert: WorkflowDelayItem) => (
                    <View
                      key={alert.id}
                      style={[
                        styles.alertItemCard,
                        alert.severity === "critical"
                          ? styles.alertItemCritical
                          : styles.alertItemWarning,
                      ]}
                    >
                      <View style={styles.alertItemHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View
                            style={[
                              styles.alertDot,
                              {
                                backgroundColor:
                                  alert.severity === "critical" ? colors.error : colors.warning,
                              },
                            ]}
                          />
                          <Text style={styles.alertItemType}>
                            {alert.itemType === "case" ? "CASE INTAKE DELAY" : "EVIDENCE REVIEW DELAY"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.delayPill,
                            alert.severity === "critical" ? styles.delayPillCrit : styles.delayPillWarn,
                          ]}
                        >
                          <Text style={styles.delayPillText}>
                            ⏱ {alert.durationHours}h in queue ({alert.severity.toUpperCase()})
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.alertItemRef}>{alert.reference}</Text>
                      <Text style={styles.alertItemTitle}>{alert.title}</Text>

                      <View style={styles.alertItemFooter}>
                        <Text style={styles.alertItemMeta}>
                          Status: <Text style={{ fontWeight: "700" }}>{alert.status}</Text>
                        </Text>
                        <Text style={styles.alertItemMeta}>
                          Assigned: <Text style={{ fontWeight: "700" }}>{alert.assignedTo}</Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.slaClearCard}>
                  <AppIcon name="check-circle" size={20} color={colors.success} />
                  <Text style={styles.slaClearText}>
                    All queues are operating within standard SLA targets (&lt;48h initial review, &lt;72h evidence verification).
                  </Text>
                </View>
              )}
            </View>

            {/* STATUS SUMMARY CARDS: CASE WORKFLOW (JN-290) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <AppIcon name="document" size={17} color={colors.navy[700]} />
                  <Text style={styles.sectionHeaderTitle}>CASE STATUS BREAKDOWN (JN-290)</Text>
                </View>
                <Text style={styles.sectionCountTag}>
                  Total: {metrics.totalCasesCount} Cases
                </Text>
              </View>

              {metrics.totalCasesCount === 0 ? (
                /* Empty Data State (JN-291 / AC 7) */
                <View style={styles.emptyStateContainer}>
                  <AppIcon name="document" size={32} color={colors.navy[200]} />
                  <Text style={styles.emptyStateTitle}>No Cases Recorded</Text>
                  <Text style={styles.emptyStateSub}>
                    There are currently zero incident reports in the system. The intake pipeline is clear.
                  </Text>
                </View>
              ) : (
                <View style={styles.statusCardsGrid}>
                  {metrics.caseStatusBreakdown.map((item) => {
                    const t = getToneStyles(item.tone);
                    return (
                      <View
                        key={item.status}
                        style={[styles.statusCard, { borderColor: t.border, backgroundColor: t.bg }]}
                      >
                        <View style={styles.statusCardTop}>
                          <Text style={[styles.statusCardName, { color: t.text }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.statusCardCount, { color: t.text }]}>
                            {item.count}
                          </Text>
                        </View>
                        {/* Progress Meter Bar */}
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.max(item.percentage, 4)}%`,
                                backgroundColor: t.text,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.statusCardBottom}>
                          <Text style={styles.statusPercentText}>{item.percentage}% of cases</Text>
                          {item.isActiveWorkflow && (
                            <Text style={styles.activeTag}>ACTIVE</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* STATUS SUMMARY CARDS: EVIDENCE WORKFLOW (JN-290) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <AppIcon name="file-search" size={17} color={colors.navy[700]} />
                  <Text style={styles.sectionHeaderTitle}>EVIDENCE VERIFICATION PIPELINE (JN-290)</Text>
                </View>
                <Text style={styles.sectionCountTag}>
                  Total: {metrics.totalEvidenceCount} Files
                </Text>
              </View>

              {metrics.totalEvidenceCount === 0 ? (
                /* Empty Data State (JN-291 / AC 7) */
                <View style={styles.emptyStateContainer}>
                  <AppIcon name="file-search" size={32} color={colors.navy[200]} />
                  <Text style={styles.emptyStateTitle}>No Evidence Files Uploaded</Text>
                  <Text style={styles.emptyStateSub}>
                    There are currently no evidence items queued or processed in the forensic repository.
                  </Text>
                </View>
              ) : (
                <View style={styles.statusCardsGrid}>
                  {metrics.evidenceStatusBreakdown.map((item) => {
                    const t = getToneStyles(item.tone);
                    return (
                      <View
                        key={item.status}
                        style={[styles.statusCard, { borderColor: t.border, backgroundColor: t.bg }]}
                      >
                        <View style={styles.statusCardTop}>
                          <Text style={[styles.statusCardName, { color: t.text }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.statusCardCount, { color: t.text }]}>
                            {item.count}
                          </Text>
                        </View>
                        {/* Progress Meter Bar */}
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.max(item.percentage, 4)}%`,
                                backgroundColor: t.text,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.statusCardBottom}>
                          <Text style={styles.statusPercentText}>{item.percentage}% of files</Text>
                          {item.isAwaitingVerification ? (
                            <Text style={[styles.activeTag, { color: "#C05621", backgroundColor: "#FEF3C7" }]}>
                              IN QUEUE
                            </Text>
                          ) : item.isCompleted ? (
                            <Text style={[styles.activeTag, { color: colors.success, backgroundColor: "#D1FAE5" }]}>
                              DONE
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* WORKLOAD & SQUAD CAPABILITY SUMMARY */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeaderTitle}>SQUAD & OPERATIONAL CAPACITY</Text>
              <View style={styles.capacityRow}>
                <View style={styles.capacityCard}>
                  <AppIcon name="user" size={18} color={colors.royal[700]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.capacityLabel}>Active Case Officers</Text>
                    <Text style={styles.capacityValue}>
                      {metrics.activeOfficersCount} Authorized Officers Assigned
                    </Text>
                  </View>
                  <Pressable
                    style={styles.capacityLinkBtn}
                    onPress={() => router.push("/admin/staff")}
                  >
                    <Text style={styles.capacityLinkText}>Manage Staff</Text>
                  </Pressable>
                </View>

                <View style={styles.capacityCard}>
                  <AppIcon name="shield-check" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.capacityLabel}>Active Evidence Checkers</Text>
                    <Text style={styles.capacityValue}>
                      {metrics.activeCheckersCount} Forensic Analysts Ready
                    </Text>
                  </View>
                  <Pressable
                    style={styles.capacityLinkBtn}
                    onPress={() => router.push("/admin/checkers" as any)}
                  >
                    <Text style={styles.capacityLinkText}>Availability</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Navigation Quick Links Footer */}
            <View style={styles.quickLinksRow}>
              <Pressable
                style={styles.quickLink}
                onPress={() => router.push("/admin/statuses" as any)}
              >
                <AppIcon name="settings" size={15} color={colors.navy[700]} />
                <Text style={styles.quickLinkText}>Configure Workflow Statuses</Text>
              </Pressable>

              <Pressable
                style={styles.quickLink}
                onPress={() => router.push("/admin/audit")}
              >
                <AppIcon name="clipboard-check" size={15} color={colors.navy[700]} />
                <Text style={styles.quickLinkText}>View Audit Logs</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[50],
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: colors.navy[800],
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 1,
    color: colors.textSecondary,
    fontSize: 11,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 36,
    gap: 14,
  },
  unauthorizedNotice: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
  },
  unauthorizedTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.error,
  },
  unauthorizedText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[800],
  },
  loadingContainer: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  errorContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F8B4B4",
    backgroundColor: "#FDE8E8",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.navy[800],
  },
  retryBtnText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  liveMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#E6F4EA",
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: colors.success,
  },
  sourceTag: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  heroMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroCard: {
    flex: 1,
    minWidth: "47%",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  heroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  heroCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  heroIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCardValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  heroCardFooter: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  sectionBlock: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.navy[800],
  },
  sectionCountTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  alertCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertCountWarn: {
    backgroundColor: "#FEF3C7",
  },
  alertCountOk: {
    backgroundColor: "#D1FAE5",
  },
  alertCountText: {
    fontSize: 10,
    fontWeight: "800",
  },
  alertTextWarn: {
    color: "#B45309",
  },
  alertTextOk: {
    color: colors.success,
  },
  alertsList: {
    gap: 8,
  },
  alertItemCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  alertItemCritical: {
    borderColor: "#F8B4B4",
    backgroundColor: "#FFF5F5",
  },
  alertItemWarning: {
    borderColor: "#FCD8A5",
    backgroundColor: "#FFFBF2",
  },
  alertItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  alertItemType: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: colors.navy[700],
  },
  delayPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  delayPillCrit: {
    backgroundColor: "#FEE2E2",
  },
  delayPillWarn: {
    backgroundColor: "#FEF3C7",
  },
  delayPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: colors.navy[800],
  },
  alertItemRef: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  alertItemTitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  alertItemFooter: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  alertItemMeta: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  slaClearCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#EAF6F0",
  },
  slaClearText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
    lineHeight: 16,
  },
  statusCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusCard: {
    flex: 1,
    minWidth: "47%",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  statusCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  statusCardName: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  statusCardCount: {
    fontSize: 14,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  statusCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPercentText: {
    fontSize: 9.5,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  activeTag: {
    fontSize: 8.5,
    fontWeight: "800",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "#E0F2FE",
    color: colors.royal[700],
  },
  emptyStateContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  emptyStateSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  capacityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  capacityCard: {
    flex: 1,
    minWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  capacityLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  capacityValue: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  capacityLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.border,
  },
  capacityLinkText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  quickLinksRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickLink: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickLinkText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[700],
  },
});
