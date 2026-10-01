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
import {
  DateRangeFilter,
  getSystemStatistics,
  SystemStatistics,
} from "../../statistics";
import { colors } from "../../theme";

const DATE_RANGE_OPTIONS: { id: DateRangeFilter; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Past 7 Days" },
  { id: "30d", label: "Past 30 Days" },
  { id: "90d", label: "Past 90 Days" },
];

const CATEGORY_FILTER_OPTIONS = [
  { id: "all", label: "All Categories" },
  { id: "Unlawful Detention", label: "Unlawful Detention" },
  { id: "Violence or Abuse", label: "Violence / Abuse" },
  { id: "Discrimination", label: "Discrimination" },
  { id: "Harassment", label: "Harassment" },
  { id: "Freedom of Expression", label: "Freedom of Expression" },
];

function formatTime(isoString?: string): string {
  if (!isoString) return "Just now";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getToneStyles(tone: "info" | "warning" | "success" | "neutral" | "danger" | "royal") {
  switch (tone) {
    case "success":
      return {
        bg: "#E8F8F0",
        border: "#B2E7CC",
        text: colors.success,
        bar: colors.success,
      };
    case "warning":
      return {
        bg: "#FEF7EC",
        border: "#FCD8A5",
        text: "#C05621",
        bar: colors.warning,
      };
    case "danger":
      return {
        bg: "#FDE8E8",
        border: "#F8B4B4",
        text: colors.error,
        bar: colors.error,
      };
    case "info":
      return {
        bg: "#EBF5FB",
        border: "#BCE0F7",
        text: colors.royal[700],
        bar: colors.royal[500],
      };
    case "royal":
      return {
        bg: "#EEF2FF",
        border: "#C7D2FE",
        text: colors.primary,
        bar: colors.primary,
      };
    default:
      return {
        bg: "#F4F6F9",
        border: "#E2E8F0",
        text: colors.textSecondary,
        bar: colors.navy[300],
      };
  }
}

export default function AdminStatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const userRole = normalizeRole(user?.role);
  const isAuthorized = userRole === "system_admin";

  const [stats, setStats] = useState<SystemStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Filter states (JN-390)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const loadStatistics = useCallback(
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

        const result = await getSystemStatistics(
          {
            dateRange: selectedDateRange,
            category: selectedCategory === "all" ? undefined : selectedCategory,
          },
          user?.role || "system_admin",
        );
        setStats(result);
      } catch (err: any) {
        console.error("System statistics load error:", err);
        setLoadError(err?.message || "Unable to compute system statistics.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthorized, selectedDateRange, selectedCategory, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStatistics();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStatistics]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.push("/admin")}
              accessibilityRole="button"
              accessibilityLabel="Back to Admin Overview"
            >
              <AppIcon name="arrow-left" size={20} color={colors.textInverse} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerSubtitle}>System Administration</Text>
              <Text style={styles.headerTitle}>System Statistics</Text>
            </View>

            <Pressable
              style={[styles.refreshButton, (loading || refreshing) && styles.refreshingButton]}
              onPress={() => void loadStatistics(true)}
              disabled={loading || refreshing}
              accessibilityRole="button"
              accessibilityLabel="Refresh Statistics"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <AppIcon name="refresh-cw" size={18} color={colors.textInverse} />
              )}
            </Pressable>
          </View>

          {/* Sync & Live Status Subheader */}
          <View style={styles.statusMetaRow}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {stats?.dataSource === "live" ? "Live Database Sync" : "Dynamic Data Engine"}
              </Text>
            </View>
            <Text style={styles.timestampText}>
              Updated: {formatTime(stats?.computedAt)}
            </Text>
          </View>
        </View>

        {/* Unauthorized State (AC 7) */}
        {!isAuthorized ? (
          <View style={styles.unauthorizedContainer}>
            <View style={styles.unauthorizedIconBox}>
              <AppIcon name="shield-alert" size={36} color={colors.error} />
            </View>
            <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
            <Text style={styles.unauthorizedMessage}>
              The System Statistics Dashboard is strictly restricted to authorized System Administrators.
            </Text>
            <Pressable
              style={styles.returnButton}
              onPress={() => router.push("/admin")}
            >
              <Text style={styles.returnButtonText}>Return to Overview</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Filter Section (JN-390) */}
            <View style={styles.filterSection}>
              <View style={styles.filterHeaderRow}>
                <View style={styles.filterLabelGroup}>
                  <AppIcon name="filter" size={14} color={colors.royal[700]} />
                  <Text style={styles.filterSectionTitle}>Period & Scope Filters</Text>
                </View>
                {(selectedDateRange !== "all" || selectedCategory !== "all") && (
                  <Pressable
                    style={styles.resetFilterButton}
                    onPress={() => {
                      setSelectedDateRange("all");
                      setSelectedCategory("all");
                    }}
                  >
                    <Text style={styles.resetFilterText}>Reset Filters</Text>
                  </Pressable>
                )}
              </View>

              {/* Date Range Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipScroll}
              >
                {DATE_RANGE_OPTIONS.map((opt) => {
                  const active = selectedDateRange === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setSelectedDateRange(opt.id)}
                    >
                      <Text
                        style={[styles.filterChipText, active && styles.filterChipTextActive]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Category Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipScrollSecondary}
              >
                {CATEGORY_FILTER_OPTIONS.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[styles.filterChipSmall, active && styles.filterChipSmallActive]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text
                        style={[
                          styles.filterChipSmallText,
                          active && styles.filterChipSmallTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Error Message */}
            {loadError ? (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-triangle" size={18} color={colors.error} />
                <Text style={styles.errorBannerText}>{loadError}</Text>
              </View>
            ) : null}

            {/* Loading Indicator */}
            {loading && !stats ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Aggregating platform metrics...</Text>
              </View>
            ) : stats ? (
              <>
                {/* Top Summary Cards (AC 1 & JN-389) */}
                <View style={styles.kpiGrid}>
                  {/* Card 1: Total Users */}
                  <View style={styles.kpiCard}>
                    <View style={styles.kpiTopRow}>
                      <Text style={styles.kpiLabel}>Total Users</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: "#EEF2FF" }]}>
                        <AppIcon name="users" size={15} color={colors.primary} />
                      </View>
                    </View>
                    <Text style={styles.kpiValue}>{stats.userStats.totalUsers}</Text>
                    <View style={styles.kpiSubRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                      <Text style={styles.kpiSubText}>
                        {stats.userStats.activeUsers} active · {stats.userStats.inactiveUsers} inactive
                      </Text>
                    </View>
                  </View>

                  {/* Card 2: Total Cases */}
                  <View style={styles.kpiCard}>
                    <View style={styles.kpiTopRow}>
                      <Text style={styles.kpiLabel}>Total Cases</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: "#E0F2FE" }]}>
                        <AppIcon name="folder-open" size={15} color={colors.royal[700]} />
                      </View>
                    </View>
                    <Text style={styles.kpiValue}>{stats.caseStats.totalCases}</Text>
                    <View style={styles.kpiSubRow}>
                      <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                      <Text style={styles.kpiSubText}>
                        {stats.caseStats.activeCases} active in pipeline
                      </Text>
                    </View>
                  </View>

                  {/* Card 3: Evidence Files */}
                  <View style={styles.kpiCard}>
                    <View style={styles.kpiTopRow}>
                      <Text style={styles.kpiLabel}>Evidence Files</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: "#FEF3C7" }]}>
                        <AppIcon name="file-search" size={15} color="#C05621" />
                      </View>
                    </View>
                    <Text style={styles.kpiValue}>{stats.evidenceStats.totalEvidence}</Text>
                    <View style={styles.kpiSubRow}>
                      <View style={[styles.statusDot, { backgroundColor: "#C05621" }]}>
                      </View>
                      <Text style={styles.kpiSubText}>
                        {stats.evidenceStats.awaitingVerification} awaiting verification
                      </Text>
                    </View>
                  </View>

                  {/* Card 4: Verification Rate */}
                  <View style={styles.kpiCard}>
                    <View style={styles.kpiTopRow}>
                      <Text style={styles.kpiLabel}>Verification Rate</Text>
                      <View style={[styles.kpiIconBox, { backgroundColor: "#D1FAE5" }]}>
                        <AppIcon name="check-circle" size={15} color={colors.success} />
                      </View>
                    </View>
                    <Text style={[styles.kpiValue, { color: colors.success }]}>
                      {stats.evidenceStats.verificationRatePercentage}%
                    </Text>
                    <View style={styles.kpiSubRow}>
                      <Text style={styles.kpiSubText}>
                        {stats.evidenceStats.completedVerification} completed of {stats.evidenceStats.totalEvidence}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Section 1: Users by Role (AC 2, JN-389) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionTitleLeft}>
                      <View style={styles.sectionBadge}>
                        <AppIcon name="users" size={14} color={colors.primary} />
                      </View>
                      <Text style={styles.sectionTitle}>Users by Role</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      {stats.userStats.totalUsers} total registered
                    </Text>
                  </View>

                  <View style={styles.roleGrid}>
                    {stats.userStats.rolesBreakdown.map((item) => {
                      const tone = getToneStyles(item.tone);
                      return (
                        <View key={item.role} style={styles.roleCard}>
                          <View style={styles.roleCardHeader}>
                            <View style={styles.roleCardTitleRow}>
                              <View style={[styles.roleIconBox, { backgroundColor: tone.bg }]}>
                                <AppIcon name={item.icon as any} size={15} color={tone.text} />
                              </View>
                              <View style={styles.roleNameGroup}>
                                <Text style={styles.roleLabel}>{item.label}</Text>
                                <Text style={styles.roleStatusText}>
                                  {item.activeCount} active · {item.inactiveCount} inactive
                                </Text>
                              </View>
                            </View>

                            <View style={styles.roleCountBox}>
                              <Text style={styles.roleCount}>{item.count}</Text>
                              <Text style={styles.rolePercentage}>{item.percentage}%</Text>
                            </View>
                          </View>

                          {/* Proportional Bar */}
                          <View style={styles.progressBarBackground}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${item.percentage}%`, backgroundColor: tone.bar },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Section 2: Cases by Status (AC 3, JN-389) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionTitleLeft}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#E0F2FE" }]}>
                        <AppIcon name="folder-open" size={14} color={colors.royal[700]} />
                      </View>
                      <Text style={styles.sectionTitle}>Cases by Status</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      {stats.caseStats.totalCases} total cases
                    </Text>
                  </View>

                  {/* Active vs Terminal Pipeline Highlights */}
                  <View style={styles.pipelineHighlightRow}>
                    <View style={[styles.pipelineHighlightBox, { backgroundColor: "#FEF7EC", borderColor: "#FCD8A5" }]}>
                      <Text style={[styles.pipelineHighlightValue, { color: "#C05621" }]}>
                        {stats.caseStats.activeCases}
                      </Text>
                      <Text style={styles.pipelineHighlightLabel}>Active Pipeline</Text>
                    </View>
                    <View style={[styles.pipelineHighlightBox, { backgroundColor: "#E8F8F0", borderColor: "#B2E7CC" }]}>
                      <Text style={[styles.pipelineHighlightValue, { color: colors.success }]}>
                        {stats.caseStats.resolvedCases}
                      </Text>
                      <Text style={styles.pipelineHighlightLabel}>Resolved Cases</Text>
                    </View>
                    <View style={[styles.pipelineHighlightBox, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}>
                      <Text style={[styles.pipelineHighlightValue, { color: colors.primary }]}>
                        {stats.caseStats.investigatingCases}
                      </Text>
                      <Text style={styles.pipelineHighlightLabel}>Under Investigation</Text>
                    </View>
                  </View>

                  <View style={styles.statusList}>
                    {stats.caseStats.statusBreakdown.map((item) => {
                      const tone = getToneStyles(item.tone);
                      return (
                        <View key={item.status} style={styles.statusRow}>
                          <View style={styles.statusLeft}>
                            <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                              <Text style={[styles.statusBadgeText, { color: tone.text }]}>
                                {item.label}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.statusBarContainer}>
                            <View style={styles.progressBarBackground}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${item.percentage}%`, backgroundColor: tone.bar },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.statusRight}>
                            <Text style={styles.statusCountText}>{item.count}</Text>
                            <Text style={styles.statusPercentageText}>{item.percentage}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Section 3: Cases by Category (AC 4, JN-389) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionTitleLeft}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#FEF3C7" }]}>
                        <AppIcon name="category" size={14} color="#C05621" />
                      </View>
                      <Text style={styles.sectionTitle}>Cases by Category</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      {stats.caseStats.categoryBreakdown.length} classifications
                    </Text>
                  </View>

                  {stats.caseStats.categoryBreakdown.length === 0 ? (
                    <View style={styles.emptyStateBox}>
                      <AppIcon name="folder-open" size={24} color={colors.textSecondary} />
                      <Text style={styles.emptyStateTitle}>No cases in selected filter</Text>
                      <Text style={styles.emptyStateMessage}>
                        Adjust the period or category filter above to see statistics.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.categoryList}>
                      {stats.caseStats.categoryBreakdown.map((item, idx) => (
                        <View key={`${item.category}-${idx}`} style={styles.categoryCard}>
                          <View style={styles.categoryCardTop}>
                            <View style={styles.categoryTitleGroup}>
                              <Text style={styles.categoryName}>{item.category}</Text>
                              <Text style={styles.categoryActiveMeta}>
                                {item.activeCount} active cases
                              </Text>
                            </View>
                            <View style={styles.categoryCountBox}>
                              <Text style={styles.categoryCount}>{item.count}</Text>
                              <Text style={styles.categoryPercentage}>{item.percentage}%</Text>
                            </View>
                          </View>

                          <View style={styles.progressBarBackground}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${item.percentage}%`,
                                  backgroundColor: colors.royal[600],
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Section 4: Evidence by Verification Status (AC 5, JN-389) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionTitleLeft}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#D1FAE5" }]}>
                        <AppIcon name="shield-check" size={14} color={colors.success} />
                      </View>
                      <Text style={styles.sectionTitle}>Evidence by Verification Status</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      {stats.evidenceStats.totalEvidence} files total
                    </Text>
                  </View>

                  <View style={styles.evidenceGrid}>
                    {stats.evidenceStats.statusBreakdown.map((item) => {
                      const tone = getToneStyles(item.tone);
                      return (
                        <View key={item.status} style={styles.evidenceCard}>
                          <View style={styles.evidenceCardHeader}>
                            <View style={[styles.evidenceBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                              <Text style={[styles.evidenceBadgeText, { color: tone.text }]}>
                                {item.label}
                              </Text>
                            </View>
                            <Text style={styles.evidenceCount}>{item.count}</Text>
                          </View>

                          <View style={styles.progressBarBackground}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${item.percentage}%`, backgroundColor: tone.bar },
                              ]}
                            />
                          </View>
                          <Text style={styles.evidencePercentageText}>{item.percentage}% of evidence</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Section 5: Workload & Staffing Ratios (JN-389) */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionTitleLeft}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#F3E8FF" }]}>
                        <AppIcon name="activity" size={14} color="#7E22CE" />
                      </View>
                      <Text style={styles.sectionTitle}>Platform Workload Ratios</Text>
                    </View>
                  </View>

                  <View style={styles.workloadGrid}>
                    <View style={styles.workloadCard}>
                      <Text style={styles.workloadCardLabel}>Avg Cases / Officer</Text>
                      <Text style={styles.workloadCardValue}>
                        {stats.workload.avgCasesPerOfficer}
                      </Text>
                      <Text style={styles.workloadCardMeta}>
                        across {stats.workload.activeOfficersCount} active investigators
                      </Text>
                    </View>

                    <View style={styles.workloadCard}>
                      <Text style={styles.workloadCardLabel}>Avg Evidence / Checker</Text>
                      <Text style={styles.workloadCardValue}>
                        {stats.workload.avgEvidencePerChecker}
                      </Text>
                      <Text style={styles.workloadCardMeta}>
                        across {stats.workload.activeCheckersCount} active checkers
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.navy[900],
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.navy[900],
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy[800],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.navy[800],
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.gold[300],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textInverse,
    marginTop: 1,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.navy[800],
    alignItems: "center",
    justifyContent: "center",
  },
  refreshingButton: {
    opacity: 0.7,
  },
  statusMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[200],
  },
  timestampText: {
    fontSize: 11,
    color: colors.navy[300],
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  filterSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterSectionTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  resetFilterButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.error,
  },
  filterChipScroll: {
    gap: 8,
  },
  filterChipScrollSecondary: {
    gap: 6,
    paddingTop: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  filterChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSmallActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipSmallText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  filterChipSmallTextActive: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FDE8E8",
    borderWidth: 1,
    borderColor: "#F8B4B4",
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.error,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  kpiCard: {
    width: "48.5%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.navy[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kpiIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy[900],
    marginTop: 6,
  },
  kpiSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiSubText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  sectionContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    shadowColor: colors.navy[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy[900],
  },
  sectionSubtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  roleGrid: {
    gap: 10,
  },
  roleCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  roleIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  roleNameGroup: {
    gap: 1,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[900],
  },
  roleStatusText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  roleCountBox: {
    alignItems: "flex-end",
  },
  roleCount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy[900],
  },
  rolePercentage: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  pipelineHighlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  pipelineHighlightBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  pipelineHighlightValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  pipelineHighlightLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.navy[800],
    marginTop: 2,
    textAlign: "center",
  },
  statusList: {
    gap: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusLeft: {
    width: 115,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBarContainer: {
    flex: 1,
  },
  statusRight: {
    width: 55,
    alignItems: "flex-end",
  },
  statusCountText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.navy[900],
  },
  statusPercentageText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  categoryList: {
    gap: 10,
  },
  categoryCard: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  categoryCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryTitleGroup: {
    flex: 1,
  },
  categoryName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[900],
  },
  categoryActiveMeta: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  categoryCountBox: {
    alignItems: "flex-end",
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy[900],
  },
  categoryPercentage: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  evidenceGrid: {
    gap: 8,
  },
  evidenceCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  evidenceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  evidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  evidenceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  evidenceCount: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.navy[900],
  },
  evidencePercentageText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: "right",
  },
  workloadGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  workloadCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  workloadCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7E22CE",
  },
  workloadCardValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#581C87",
    marginTop: 4,
  },
  workloadCardMeta: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyStateBox: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  emptyStateMessage: {
    fontSize: 11.5,
    color: colors.textSecondary,
    textAlign: "center",
  },
  unauthorizedContainer: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  unauthorizedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy[900],
  },
  unauthorizedMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  returnButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.royal[700],
  },
  returnButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
