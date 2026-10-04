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

import { AppIcon } from "../../components/AppIcon";
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
type FilterType = "all" | "unassigned" | "assigned" | "priority";

type AdminCase = {
  id: string;
  case_reference: string;
  title: string;
  category: string | null;
  district: string | null;
  status: CaseStatus;
  priority: CasePriority;
  created_at: string;
  updated_at: string;
};

type CaseOfficer = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean | null;
};

type CaseAssignment = {
  id: string;
  case_id: string;
  assigned_officer_id: string;
  assigned_at: string | null;
  is_active: boolean;
};

export default function AdminCaseAssignmentScreen() {
  const router = useRouter();

  const [cases, setCases] = useState<AdminCase[]>([]);
  const [assignments, setAssignments] = useState<CaseAssignment[]>([]);
  const [officers, setOfficers] = useState<CaseOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("unassigned");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCase, setSelectedCase] = useState<AdminCase | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const loadData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setErrorMessage("");

      const [casesResult, officersResult, assignmentsResult] =
        await Promise.all([
          supabase
            .from("cases")
            .select(
              `
                id,
                case_reference,
                title,
                category,
                district,
                status,
                priority,
                created_at,
                updated_at
              `,
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("profiles")
            .select("id, full_name, email, is_active")
            .eq("role", "case_officer")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          supabase
            .from("case_assignments")
            .select("id, case_id, assigned_officer_id, assigned_at, is_active")
            .eq("is_active", true),
        ]);

      if (casesResult.error) {
        setErrorMessage(casesResult.error.message);
        return;
      }

      if (officersResult.error) {
        setErrorMessage(officersResult.error.message);
        return;
      }

      if (assignmentsResult.error) {
        setErrorMessage(assignmentsResult.error.message);
        return;
      }

      setCases((casesResult.data ?? []) as AdminCase[]);
      setOfficers((officersResult.data ?? []) as CaseOfficer[]);
      setAssignments((assignmentsResult.data ?? []) as CaseAssignment[]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load case assignment data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadData]);

  const assignmentByCaseId = useMemo(() => {
    const map: Record<string, CaseAssignment> = {};

    assignments.forEach((assignment) => {
      map[assignment.case_id] = assignment;
    });

    return map;
  }, [assignments]);

  const officerById = useMemo(() => {
    const map: Record<string, CaseOfficer> = {};

    officers.forEach((officer) => {
      map[officer.id] = officer;
    });

    return map;
  }, [officers]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cases.filter((caseItem) => {
      const assignment = assignmentByCaseId[caseItem.id];
      const assigned = Boolean(assignment);

      const matchesSearch =
        query === "" ||
        caseItem.case_reference.toLowerCase().includes(query) ||
        caseItem.title.toLowerCase().includes(query) ||
        (caseItem.category ?? "").toLowerCase().includes(query) ||
        (caseItem.district ?? "").toLowerCase().includes(query) ||
        (
          officerById[assignment?.assigned_officer_id ?? ""]?.full_name ?? ""
        )
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      switch (activeFilter) {
        case "unassigned":
          return !assigned;
        case "assigned":
          return assigned;
        case "priority":
          return caseItem.priority === "urgent" || caseItem.priority === "high";
        case "all":
        default:
          return true;
      }
    });
  }, [activeFilter, assignmentByCaseId, cases, officerById, search]);

  const stats = useMemo(
    () => ({
      total: cases.length,
      assigned: assignments.length,
      unassigned: Math.max(cases.length - assignments.length, 0),
      priority: cases.filter(
        (caseItem) =>
          caseItem.priority === "urgent" || caseItem.priority === "high",
      ).length,
    }),
    [assignments.length, cases],
  );

  const openAssignmentModal = (caseItem: AdminCase) => {
    const existing = assignmentByCaseId[caseItem.id];

    setSelectedCase(caseItem);
    setSelectedOfficerId(existing?.assigned_officer_id ?? officers[0]?.id ?? "");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setSelectedCase(null);
    setSelectedOfficerId("");
  };

  const completeAssignment = async () => {
    if (!selectedCase || !selectedOfficerId) {
      return;
    }

    const officer = officerById[selectedOfficerId];

    if (!officer) {
      Alert.alert("Select an officer", "Choose an active Case Officer first.");
      return;
    }

    try {
      setSaving(true);

      const { error: assignmentError } = await supabase.rpc(
        "assign_case_to_officer",
        {
          p_case_id: selectedCase.id,
          p_officer_id: selectedOfficerId,
        },
      );

      if (assignmentError) {
        throw assignmentError;
      }

      closeModal();
      await loadData(false);
    } catch (error) {
      Alert.alert(
        "Assignment failed",
        error instanceof Error
          ? error.message
          : "JusticeNow could not assign this case.",
      );
    } finally {
      setSaving(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    void loadData(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />
        <Text style={styles.loadingText}>Loading case assignments...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace("/admin")}
          accessibilityRole="button"
          accessibilityLabel="Back to administrator dashboard"
          style={styles.backButton}
        >
          <AppIcon name="chevron-left" size={20} color={colors.navy[700]} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Case assignments</Text>
          <Text style={styles.headerSubtitle}>
            Assign active cases to Case Officers
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.royal[700]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>ADMIN CASE ROUTING</Text>
          <Text style={styles.summaryTitle}>Officer assignment queue</Text>
          <Text style={styles.summaryText}>
            {stats.unassigned} unassigned case
            {stats.unassigned === 1 ? "" : "s"} need an officer. Assigned
            cases appear immediately inside that officer workspace.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <SummaryStat label="Total" value={stats.total} />
          <SummaryStat label="Unassigned" value={stats.unassigned} />
          <SummaryStat label="Assigned" value={stats.assigned} />
          <SummaryStat label="Priority" value={stats.priority} />
        </View>

        <View style={styles.searchBox}>
          <AppIcon name="search" size={iconSizes.sm} color={colors.textSoft} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search case ID, title, district, officer..."
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <AppIcon name="x" size={iconSizes.sm} color={colors.textSoft} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            label="Unassigned"
            active={activeFilter === "unassigned"}
            onPress={() => setActiveFilter("unassigned")}
          />
          <FilterChip
            label="Assigned"
            active={activeFilter === "assigned"}
            onPress={() => setActiveFilter("assigned")}
          />
          <FilterChip
            label="Priority"
            active={activeFilter === "priority"}
            onPress={() => setActiveFilter("priority")}
          />
          <FilterChip
            label="All cases"
            active={activeFilter === "all"}
            onPress={() => setActiveFilter("all")}
          />
        </ScrollView>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Unable to load assignments</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Cases</Text>
          <Text style={styles.resultsCount}>{filteredCases.length} found</Text>
        </View>

        {filteredCases.map((caseItem) => {
          const assignment = assignmentByCaseId[caseItem.id];

          return (
            <CaseAssignmentCard
              key={caseItem.id}
              caseItem={caseItem}
              assignment={assignment}
              officer={
                assignment
                  ? officerById[assignment.assigned_officer_id]
                  : undefined
              }
              onAssign={() => openAssignmentModal(caseItem)}
            />
          );
        })}

        {filteredCases.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="folder-open" size={30} color={colors.royal[700]} />
            <Text style={styles.emptyTitle}>
              {cases.length === 0 ? "No readable cases" : "No cases found"}
            </Text>
            <Text style={styles.emptyText}>
              {cases.length === 0
                ? "If reporters have submitted cases, apply scripts/seeds/012_admin_case_assignments.sql so System Admins can read and assign them under RLS."
              : "Change the search text or selected assignment filter."}
            </Text>
          </View>
        ) : null}

        <View style={styles.securityNotice}>
          <AppIcon name="lock" size={iconSizes.sm} color={colors.teal[800]} />

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Protected assignment access</Text>

            <Text style={styles.securityText}>
              JusticeNow only allows active System Admins to view this queue and
              assign cases to active Case Officer accounts.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={selectedCase !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>Assign Case Officer</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedCase?.case_reference}
                </Text>
              </View>
              <Pressable onPress={closeModal} disabled={saving}>
                <AppIcon name="x" size={20} color={colors.navy[700]} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {officers.length === 0 ? (
                <View style={styles.emptyOfficerBox}>
                  <Text style={styles.emptyTitle}>No active officers</Text>
                  <Text style={styles.emptyText}>
                    Create or activate a Case Officer account before assigning
                    cases.
                  </Text>
                </View>
              ) : (
                officers.map((officer) => {
                  const selected = officer.id === selectedOfficerId;

                  return (
                    <Pressable
                      key={officer.id}
                      style={[
                        styles.officerOption,
                        selected && styles.selectedOfficerOption,
                      ]}
                      onPress={() => setSelectedOfficerId(officer.id)}
                    >
                      <View
                        style={[
                          styles.radio,
                          selected && styles.selectedRadio,
                        ]}
                      >
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>

                      <View style={styles.officerText}>
                        <Text style={styles.officerName}>
                          {officer.full_name || "Case Officer"}
                        </Text>
                        <Text style={styles.officerEmail}>
                          {officer.email || officer.id}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.assignButton,
                  (!selectedOfficerId || officers.length === 0) &&
                    styles.disabledButton,
                ]}
                onPress={() => void completeAssignment()}
                disabled={saving || !selectedOfficerId || officers.length === 0}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <>
                    <AppIcon
                      name="user-plus"
                      size={16}
                      color={colors.textInverse}
                    />
                    <Text style={styles.assignButtonText}>Assign</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({
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
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, active && styles.activeChip]}
    >
      <Text style={[styles.chipText, active && styles.activeChipText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CaseAssignmentCard({
  caseItem,
  assignment,
  officer,
  onAssign,
}: {
  caseItem: AdminCase;
  assignment?: CaseAssignment;
  officer?: CaseOfficer;
  onAssign: () => void;
}) {
  const assigned = Boolean(assignment);

  return (
    <View style={styles.caseCard}>
      <View style={styles.caseTopRow}>
        <Text style={styles.caseReference}>{caseItem.case_reference}</Text>
        <PriorityBadge priority={caseItem.priority} />
      </View>

      <Text style={styles.caseTitle}>{caseItem.title}</Text>

      <View style={styles.metaGrid}>
        <MetaItem label="Category" value={caseItem.category || "Not set"} />
        <MetaItem label="District" value={caseItem.district || "Not set"} />
      </View>

      <View style={styles.assignmentBox}>
        <View style={styles.assignmentIcon}>
          <AppIcon
            name={assigned ? "check-circle" : "user-plus"}
            size={16}
            color={assigned ? colors.teal[800] : colors.royal[700]}
          />
        </View>

        <View style={styles.assignmentText}>
          <Text style={styles.assignmentLabel}>
            {assigned ? "Assigned officer" : "No officer assigned"}
          </Text>
          <Text style={styles.assignmentValue}>
            {assigned
              ? officer?.full_name || officer?.email || "Case Officer"
              : "Assign this case so it appears in an officer workspace."}
          </Text>
        </View>
      </View>

      <View style={styles.caseFooter}>
        <StatusBadge status={caseItem.status} />
        <Pressable style={styles.assignAction} onPress={onAssign}>
          <Text style={styles.assignActionText}>
            {assigned ? "Reassign" : "Assign"}
          </Text>
          <AppIcon name="chevron-right" size={18} color={colors.royal[700]} />
        </Pressable>
      </View>
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusBadgeText}>{formatStatus(status)}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  return (
    <View
      style={[
        styles.priorityBadge,
        priority === "urgent" && styles.priorityUrgent,
        priority === "high" && styles.priorityHigh,
      ]}
    >
      <Text
        style={[
          styles.priorityText,
          priority === "urgent" && styles.priorityUrgentText,
        ]}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Text>
    </View>
  );
}

function formatStatus(status: CaseStatus) {
  switch (status) {
    case "under_review":
      return "Under review";
    case "awaiting_information":
      return "Awaiting information";
    case "awaiting_evidence":
      return "Awaiting evidence";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
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
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 22,
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
    paddingBottom: 30,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.navy[800],
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.7,
    color: "#AFC2D9",
  },
  summaryTitle: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: "600",
    color: colors.textInverse,
  },
  summaryText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#DCE5EF",
  },
  statsGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 82,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.navy[800],
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  searchBox: {
    minHeight: 48,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 13,
    color: colors.navy[800],
    outlineStyle: "none",
  } as any,
  filters: {
    gap: 7,
    paddingVertical: 13,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  activeChip: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.navy[700],
  },
  activeChipText: {
    color: colors.textInverse,
    fontWeight: "600",
  },
  errorBox: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    backgroundColor: "#FFF2F1",
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },
  errorText: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  resultsHeader: {
    marginTop: 4,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  caseCard: {
    marginBottom: 11,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  caseTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  caseReference: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: colors.royal[700],
  },
  caseTitle: {
    marginTop: 8,
    fontSize: 14.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  metaGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.textSoft,
  },
  metaValue: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
    color: colors.navy[700],
  },
  assignmentBox: {
    marginTop: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },
  assignmentIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  assignmentText: {
    flex: 1,
    minWidth: 0,
  },
  assignmentLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[800],
  },
  assignmentValue: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  caseFooter: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.royal[50],
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.navy[50],
  },
  priorityUrgent: {
    backgroundColor: "#FFF0EF",
  },
  priorityHigh: {
    backgroundColor: colors.gold[50],
  },
  priorityText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  priorityUrgentText: {
    color: colors.error,
  },
  assignAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  assignActionText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
  emptyCard: {
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  securityNotice: {
    flexDirection: "row",
    marginTop: 6,
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
    fontSize: 12,
    fontWeight: "600",
    color: colors.teal[800],
  },
  securityText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,27,46,0.58)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: Platform.OS === "web" ? "88%" : "92%",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  modalContent: {
    padding: 18,
    gap: 9,
  },
  officerOption: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedOfficerOption: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[50],
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.navy[200],
  },
  selectedRadio: {
    borderColor: colors.royal[700],
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.royal[700],
  },
  officerText: {
    flex: 1,
    minWidth: 0,
  },
  officerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  officerEmail: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  emptyOfficerBox: {
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.navy[50],
  },
  modalActions: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },
  assignButton: {
    minWidth: 110,
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.royal[700],
  },
  disabledButton: {
    opacity: 0.5,
  },
  assignButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
