import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { RoleGuard, useAuth } from "../../auth";
import { AppIcon } from "../../components/AppIcon";
import {
  CheckerAvailabilityRecord,
  CheckerAvailabilityStatus,
  getCheckerAssignmentHistory,
  getEvidenceCheckersWithAvailability,
  setCheckerAvailability,
} from "../../staff";
import { colors } from "../../theme";

type FilterTab = "all" | "available" | "busy" | "inactive";

export default function EvidenceCheckerAvailabilityScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [checkers, setCheckers] = useState<CheckerAvailabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Manage Status Modal State
  const [selectedChecker, setSelectedChecker] =
    useState<CheckerAvailabilityRecord | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newIsActive, setNewIsActive] = useState(true);
  const [newAvailability, setNewAvailability] =
    useState<CheckerAvailabilityStatus>("available");
  const [updateReason, setUpdateReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignmentHistoryCount, setAssignmentHistoryCount] = useState({
    active: 0,
    historical: 0,
    total: 0,
  });

  const loadCheckers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEvidenceCheckersWithAvailability({
        searchQuery,
      });
      setCheckers(data);
    } catch (err: any) {
      console.error("Failed to load evidence checkers:", err);
      Alert.alert("Error", err.message || "Unable to load Evidence Checkers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCheckers();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadCheckers]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadCheckers();
  };

  // KPI Metrics Calculation
  const stats = useMemo(() => {
    const total = checkers.length;
    const activeAvailable = checkers.filter(
      (c) => c.isActive && c.availabilityStatus === "available",
    ).length;
    const busy = checkers.filter(
      (c) => c.isActive && c.availabilityStatus === "busy",
    ).length;
    const inactive = checkers.filter(
      (c) => !c.isActive || c.availabilityStatus === "inactive",
    ).length;

    return { total, activeAvailable, busy, inactive };
  }, [checkers]);

  // Tab Filtering
  const filteredCheckers = useMemo(() => {
    return checkers.filter((checker) => {
      if (activeTab === "available") {
        return checker.isActive && checker.availabilityStatus === "available";
      }
      if (activeTab === "busy") {
        return checker.isActive && checker.availabilityStatus === "busy";
      }
      if (activeTab === "inactive") {
        return !checker.isActive || checker.availabilityStatus === "inactive";
      }
      return true;
    });
  }, [checkers, activeTab]);

  // Open Manage Modal (JN-270 Confirmation Step)
  const openManageModal = (checker: CheckerAvailabilityRecord) => {
    setSelectedChecker(checker);
    setNewIsActive(checker.isActive);
    setNewAvailability(checker.availabilityStatus);
    setUpdateReason("");

    const history = getCheckerAssignmentHistory(checker.id);
    setAssignmentHistoryCount({
      active: history.activeAssignments.length,
      historical: history.historicalAssignments.length,
      total: history.totalAssignmentsCount,
    });

    setModalVisible(true);
  };

  // Submit Availability Update (JN-268, JN-270, JN-271)
  const handleConfirmUpdate = async () => {
    if (!selectedChecker) return;

    try {
      setSubmitting(true);
      const res = await setCheckerAvailability({
        checkerId: selectedChecker.id,
        isActive: newIsActive,
        availabilityStatus: newAvailability,
        actorRole: "system_admin",
        actorId: user?.id,
        actorEmail: user?.email,
        reason: updateReason.trim() || undefined,
      });

      if (!res.success) {
        Alert.alert("Update Failed", res.error || "Unable to update status.");
        return;
      }

      setModalVisible(false);
      void loadCheckers();

      let successMsg = `Evidence Checker '${selectedChecker.fullName}' status updated to ${newAvailability.toUpperCase()}.`;
      if (res.warning) {
        successMsg += `\n\n⚠️ ${res.warning}`;
      }

      Alert.alert("Status Updated", successMsg);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update availability.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back to Admin dashboard"
          >
            <AppIcon name="chevron-left" size={20} color={colors.navy[800]} />
          </Pressable>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Checker Availability</Text>
            <Text style={styles.headerSub}>
              Manage active verification staff & assignment eligibility
            </Text>
          </View>

          <Pressable
            style={styles.auditIconBtn}
            onPress={() => router.push("/admin/audit")}
            accessibilityRole="button"
            accessibilityLabel="View Audit Trail"
          >
            <AppIcon name="history" size={20} color={colors.royal[700]} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.royal[700]]}
            />
          }
        >
          {/* Summary Metric Cards */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Staff</Text>
              <Text style={[styles.metricValue, { color: colors.navy[900] }]}>
                {stats.total}
              </Text>
              <Text style={styles.metricSub}>Checkers</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Available</Text>
              <Text style={[styles.metricValue, { color: colors.success }]}>
                {stats.activeAvailable}
              </Text>
              <Text style={styles.metricSub}>Ready for work</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Busy</Text>
              <Text style={[styles.metricValue, { color: colors.warning }]}>
                {stats.busy}
              </Text>
              <Text style={styles.metricSub}>Under review</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Inactive</Text>
              <Text style={[styles.metricValue, { color: colors.error }]}>
                {stats.inactive}
              </Text>
              <Text style={styles.metricSub}>No assignments</Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <AppIcon name="search" size={18} color={colors.navy[400]} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by checker name, email, or department..."
              placeholderTextColor={colors.navy[300]}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            <TabChip
              label={`All (${stats.total})`}
              active={activeTab === "all"}
              onPress={() => setActiveTab("all")}
            />
            <TabChip
              label={`Available (${stats.activeAvailable})`}
              active={activeTab === "available"}
              onPress={() => setActiveTab("available")}
            />
            <TabChip
              label={`Busy (${stats.busy})`}
              active={activeTab === "busy"}
              onPress={() => setActiveTab("busy")}
            />
            <TabChip
              label={`Inactive (${stats.inactive})`}
              active={activeTab === "inactive"}
              onPress={() => setActiveTab("inactive")}
            />
          </View>

          {/* Policy Guard Notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeIcon}>🛡️</Text>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Assignment Guardrails (JN-269)
              </Text>
              <Text style={styles.noticeText}>
                Only <Text style={styles.bold}>Active & Available</Text> Evidence
                Checkers receive new forensic assignments. Deactivating an
                account prevents new work while preserving complete historical
                audit traceability.
              </Text>
            </View>
          </View>

          {/* Checkers List */}
          {loading && !refreshing ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.royal[700]} />
              <Text style={styles.loadingText}>
                Loading Evidence Checkers availability...
              </Text>
            </View>
          ) : filteredCheckers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No Evidence Checkers Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search query or filter tab.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredCheckers.map((checker) => (
                <CheckerCard
                  key={checker.id}
                  checker={checker}
                  onManage={() => openManageModal(checker)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* Confirmation & Availability Modal (JN-270) */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Manage Availability</Text>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>

              {selectedChecker && (
                <ScrollView style={styles.modalBody}>
                  {/* Checker Info Header */}
                  <View style={styles.modalCheckerInfo}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>
                        {selectedChecker.fullName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalCheckerName}>
                        {selectedChecker.fullName}
                      </Text>
                      <Text style={styles.modalCheckerEmail}>
                        {selectedChecker.email}
                      </Text>
                      <Text style={styles.modalCheckerDept}>
                        {selectedChecker.department || "Forensic Unit"}
                      </Text>
                    </View>
                  </View>

                  {/* Workload Summary */}
                  <View style={styles.workloadBox}>
                    <Text style={styles.workloadLabel}>
                      Current Active Reviews:
                    </Text>
                    <Text style={styles.workloadValue}>
                      {assignmentHistoryCount.active} active assignment(s)
                    </Text>
                  </View>

                  {/* Warning if deactivating checker with active assignments */}
                  {!newIsActive && assignmentHistoryCount.active > 0 && (
                    <View style={styles.modalWarningBox}>
                      <Text style={styles.modalWarningIcon}>⚠️</Text>
                      <Text style={styles.modalWarningText}>
                        <Text style={styles.bold}>Caution:</Text> This checker
                        has {assignmentHistoryCount.active} active review(s).
                        Deactivating will block future assignments, but all
                        previous records remain traceable (AC 4).
                      </Text>
                    </View>
                  )}

                  {/* Status Options */}
                  <Text style={styles.sectionHeading}>
                    Select Availability State (JN-267):
                  </Text>

                  <Pressable
                    style={[
                      styles.statusOption,
                      newIsActive &&
                        newAvailability === "available" &&
                        styles.statusOptionSelected,
                    ]}
                    onPress={() => {
                      setNewIsActive(true);
                      setNewAvailability("available");
                    }}
                  >
                    <Text style={styles.statusOptionIcon}>🟢</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusOptionTitle}>
                        Active · Available
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Eligible to receive new evidence verification assignments.
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.statusOption,
                      newIsActive &&
                        newAvailability === "busy" &&
                        styles.statusOptionSelected,
                    ]}
                    onPress={() => {
                      setNewIsActive(true);
                      setNewAvailability("busy");
                    }}
                  >
                    <Text style={styles.statusOptionIcon}>🟡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusOptionTitle}>
                        Active · High Workload (Busy)
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Remains active with high assignment queue.
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.statusOption,
                      newIsActive &&
                        newAvailability === "away" &&
                        styles.statusOptionSelected,
                    ]}
                    onPress={() => {
                      setNewIsActive(true);
                      setNewAvailability("away");
                    }}
                  >
                    <Text style={styles.statusOptionIcon}>🟠</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusOptionTitle}>
                        Active · On Leave / Away
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Temporarily excluded from new assignments.
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.statusOption,
                      !newIsActive && styles.statusOptionSelectedDanger,
                    ]}
                    onPress={() => {
                      setNewIsActive(false);
                      setNewAvailability("inactive");
                    }}
                  >
                    <Text style={styles.statusOptionIcon}>🔴</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.statusOptionTitle,
                          !newIsActive && { color: colors.error },
                        ]}
                      >
                        Deactivate Checker Account
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Account disabled. Blocked from receiving new evidence.
                      </Text>
                    </View>
                  </Pressable>

                  {/* Audit Reason Input */}
                  <View style={styles.reasonGroup}>
                    <Text style={styles.reasonLabel}>
                      Audit Reason / Administrative Note (JN-271):
                    </Text>
                    <TextInput
                      style={styles.reasonInput}
                      value={updateReason}
                      onChangeText={setUpdateReason}
                      placeholder="e.g., Staff on leave, shift rotation, capacity rebalance..."
                      placeholderTextColor={colors.navy[300]}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => setModalVisible(false)}
                      disabled={submitting}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.confirmButton,
                        !newIsActive && styles.confirmButtonDanger,
                        submitting && { opacity: 0.6 },
                      ]}
                      onPress={handleConfirmUpdate}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color={colors.textInverse} />
                      ) : (
                        <Text style={styles.confirmText}>
                          Confirm Status Change
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tabChip, active && styles.tabChipActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.tabChipText, active && styles.tabChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CheckerCard({
  checker,
  onManage,
}: {
  checker: CheckerAvailabilityRecord;
  onManage: () => void;
}) {
  let badgeColor = colors.success;
  let badgeBg = "#EAF6F0";
  let badgeText = "Available";
  let badgeIcon = "🟢";

  if (!checker.isActive || checker.availabilityStatus === "inactive") {
    badgeColor = colors.error;
    badgeBg = "#FFF2F1";
    badgeText = "Deactivated";
    badgeIcon = "🔴";
  } else if (checker.availabilityStatus === "busy") {
    badgeColor = colors.warning;
    badgeBg = "#FDF6E7";
    badgeText = "High Workload (Busy)";
    badgeIcon = "🟡";
  } else if (checker.availabilityStatus === "away") {
    badgeColor = "#D97706";
    badgeBg = "#FEF3C7";
    badgeText = "Away on Leave";
    badgeIcon = "🟠";
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {checker.fullName.slice(0, 2).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.checkerName}>{checker.fullName}</Text>
          <Text style={styles.checkerEmail}>{checker.email}</Text>
          <Text style={styles.checkerDept}>
            {checker.department || "Forensic Unit"}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
          <Text style={styles.badgeIcon}>{badgeIcon}</Text>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
            {badgeText}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBottom}>
        <View style={styles.workloadIndicator}>
          <Text style={styles.workloadTitle}>Active Assignments:</Text>
          <View
            style={[
              styles.countPill,
              checker.activeAssignmentsCount > 3 && styles.countPillWarn,
            ]}
          >
            <Text
              style={[
                styles.countPillText,
                checker.activeAssignmentsCount > 3 && { color: colors.warning },
              ]}
            >
              {checker.activeAssignmentsCount} items
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.manageBtn}
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel={`Manage availability for ${checker.fullName}`}
        >
          <Text style={styles.manageBtnText}>Update Status</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.navy[50],
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  auditIconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.royal[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 9.5,
    color: colors.textSecondary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.navy[900],
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tabChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
  },
  tabChipActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  tabChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  tabChipTextActive: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  noticeCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[200],
    marginBottom: 16,
    gap: 10,
  },
  noticeIcon: {
    fontSize: 18,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[900],
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: "700",
    color: colors.navy[900],
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  listContainer: {
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.royal[50],
    borderWidth: 1,
    borderColor: colors.royal[200],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.royal[700],
  },
  cardMain: {
    flex: 1,
  },
  checkerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
  },
  checkerEmail: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  checkerDept: {
    fontSize: 11,
    color: colors.royal[700],
    fontWeight: "600",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 10,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  workloadIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  workloadTitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.navy[50],
  },
  countPillWarn: {
    backgroundColor: "#FEF3C7",
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[800],
  },
  manageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  manageBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.navy[50],
  },
  modalCloseText: {
    fontSize: 14,
    color: colors.navy[700],
    fontWeight: "700",
  },
  modalBody: {
    maxHeight: 480,
  },
  modalCheckerInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.navy[50],
    marginBottom: 12,
    gap: 10,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.royal[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.royal[800],
  },
  modalCheckerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
  },
  modalCheckerEmail: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  modalCheckerDept: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.royal[700],
    marginTop: 2,
  },
  workloadBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  workloadLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  workloadValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[900],
  },
  modalWarningBox: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 12,
    gap: 8,
  },
  modalWarningIcon: {
    fontSize: 14,
  },
  modalWarningText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: "#B91C1C",
  },
  sectionHeading: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[900],
    marginBottom: 8,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
    gap: 10,
  },
  statusOptionSelected: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },
  statusOptionSelectedDanger: {
    borderColor: colors.error,
    backgroundColor: "#FFF2F1",
  },
  statusOptionIcon: {
    fontSize: 16,
  },
  statusOptionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[900],
  },
  statusOptionDesc: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  reasonGroup: {
    marginTop: 6,
    marginBottom: 14,
  },
  reasonLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[800],
    marginBottom: 4,
  },
  reasonInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    fontSize: 12,
    color: colors.navy[900],
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.navy[100],
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  confirmButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  confirmButtonDanger: {
    backgroundColor: colors.error,
  },
  confirmText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
