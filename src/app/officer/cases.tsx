import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

type JusticeCase = {
  id: string;
  case_reference: string;
  title: string;
  description: string | null;
  category: string;
  incident_date: string | null;
  district: string | null;
  status: CaseStatus;
  priority: CasePriority;
  created_at: string;
  updated_at: string;
};

type FilterType =
  | "all"
  | "new"
  | "in_progress"
  | "awaiting_evidence"
  | "priority";

export default function AssignedCasesScreen() {
  const router = useRouter();

  const [cases, setCases] = useState<JusticeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [errorMessage, setErrorMessage] = useState("");

  const loadCases = useCallback(
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

        const { data, error } = await supabase
          .from("case_assignments")
          .select(
            `
              id,
              assigned_at,
              cases (
                id,
                case_reference,
                title,
                description,
                category,
                incident_date,
                district,
                status,
                priority,
                created_at,
                updated_at
              )
            `,
          )
          .eq("assigned_officer_id", user.id)
          .eq("is_active", true)
          .order("assigned_at", {
            ascending: false,
          });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        const assignedCases: JusticeCase[] = (data ?? [])
          .map((assignment: any) => assignment.cases)
          .filter(Boolean);

        setCases(assignedCases);
      } catch (error) {
        console.error("LOAD ASSIGNED CASES ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load your assigned cases.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadCases(false);
  };

  const filteredCases = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return cases.filter((caseItem) => {
      const matchesSearch =
        cleanSearch === "" ||
        caseItem.title.toLowerCase().includes(cleanSearch) ||
        caseItem.case_reference.toLowerCase().includes(cleanSearch) ||
        caseItem.category.toLowerCase().includes(cleanSearch) ||
        (caseItem.district ?? "").toLowerCase().includes(cleanSearch);

      if (!matchesSearch) {
        return false;
      }

      switch (activeFilter) {
        case "new":
          return (
            caseItem.status === "assigned" ||
            caseItem.status === "submitted" ||
            caseItem.status === "under_review"
          );

        case "in_progress":
          return (
            caseItem.status === "investigating" ||
            caseItem.status === "under_review" ||
            caseItem.status === "awaiting_information"
          );

        case "awaiting_evidence":
          return caseItem.status === "awaiting_evidence";

        case "priority":
          return caseItem.priority === "high" || caseItem.priority === "urgent";

        case "all":
        default:
          return true;
      }
    });
  }, [activeFilter, cases, search]);

  const openCase = (caseItem: JusticeCase) => {
    router.push({
      pathname: "/officer/case-details",
      params: {
        id: caseItem.id,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading assigned cases...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Assigned Cases</Text>

          <Text style={styles.headerSubtitle}>Case Officer Workspace</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.royal[700]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>YOUR CASELOAD</Text>

          <Text style={styles.infoTitle}>Assigned investigations</Text>

          <Text style={styles.infoText}>
            {cases.length} {cases.length === 1 ? "case is" : "cases are"}{" "}
            currently assigned to your officer account.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔎</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search case ID, title, category..."
            placeholderTextColor={colors.textSoft}
            autoCorrect={false}
            style={styles.searchInput}
          />

          {search !== "" && (
            <Pressable onPress={() => setSearch("")} accessibilityRole="button">
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            label="All"
            active={activeFilter === "all"}
            onPress={() => setActiveFilter("all")}
          />

          <FilterChip
            label="New"
            active={activeFilter === "new"}
            onPress={() => setActiveFilter("new")}
          />

          <FilterChip
            label="In progress"
            active={activeFilter === "in_progress"}
            onPress={() => setActiveFilter("in_progress")}
          />

          <FilterChip
            label="Awaiting evidence"
            active={activeFilter === "awaiting_evidence"}
            onPress={() => setActiveFilter("awaiting_evidence")}
          />

          <FilterChip
            label="Priority"
            active={activeFilter === "priority"}
            onPress={() => setActiveFilter("priority")}
          />
        </ScrollView>

        {errorMessage !== "" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Unable to load cases</Text>

            <Text style={styles.errorText}>{errorMessage}</Text>

            <Pressable
              onPress={() => void loadCases()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {errorMessage === "" && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Cases</Text>

            <Text style={styles.resultsCount}>
              {filteredCases.length} found
            </Text>
          </View>
        )}

        {errorMessage === "" &&
          filteredCases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              caseItem={caseItem}
              onPress={() => openCase(caseItem)}
            />
          ))}

        {errorMessage === "" && filteredCases.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>📁</Text>
            </View>

            <Text style={styles.emptyTitle}>No matching cases</Text>

            <Text style={styles.emptyDescription}>
              {cases.length === 0
                ? "There are currently no active cases assigned to your Case Officer account."
                : "No assigned cases match the selected search or filter."}
            </Text>
          </View>
        )}

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Restricted case access</Text>

            <Text style={styles.securityText}>
              JusticeNow only returns cases actively assigned to your
              authenticated Case Officer account.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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

function CaseCard({
  caseItem,
  onPress,
}: {
  caseItem: JusticeCase;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open case ${caseItem.case_reference}`}
      style={({ pressed }) => [styles.caseCard, pressed && styles.casePressed]}
    >
      <View style={styles.caseTopRow}>
        <Text style={styles.caseReference}>{caseItem.case_reference}</Text>

        <PriorityBadge priority={caseItem.priority} />
      </View>

      <Text style={styles.caseTitle}>{caseItem.title}</Text>

      <Text numberOfLines={2} style={styles.caseDescription}>
        {caseItem.description ?? "No case description available."}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Category</Text>

          <Text numberOfLines={1} style={styles.metaValue}>
            {caseItem.category}
          </Text>
        </View>

        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>District</Text>

          <Text style={styles.metaValue}>
            {caseItem.district ?? "Not specified"}
          </Text>
        </View>
      </View>

      <View style={styles.caseFooter}>
        <StatusBadge status={caseItem.status} />

        <Text style={styles.openText}>Open case ›</Text>
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const getLabel = () => {
    switch (status) {
      case "under_review":
        return "Under review";
      case "assigned":
        return "Assigned";
      case "investigating":
        return "Investigating";
      case "awaiting_evidence":
        return "Awaiting evidence";
      case "awaiting_information":
        return "Awaiting information";
      case "resolved":
        return "Resolved";
      case "closed":
        return "Closed";
      case "submitted":
      default:
        return "Submitted";
    }
  };

  return (
    <View
      style={[
        styles.statusBadge,
        status === "investigating" && styles.statusBlue,
        status === "awaiting_evidence" && styles.statusGold,
        status === "awaiting_information" && styles.statusGold,
        status === "resolved" && styles.statusGreen,
        status === "closed" && styles.statusGrey,
      ]}
    >
      <Text style={styles.statusBadgeText}>{getLabel()}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <View
      style={[
        styles.priorityBadge,
        priority === "urgent" && styles.priorityUrgent,
        priority === "high" && styles.priorityHigh,
        priority === "medium" && styles.priorityMedium,
      ]}
    >
      <Text
        style={[
          styles.priorityText,
          priority === "urgent" && styles.priorityUrgentText,
        ]}
      >
        {label}
      </Text>
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
  backText: {
    fontSize: 32,
    color: colors.navy[700],
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 34,
  },
  infoCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.navy[800],
  },
  infoLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: "#AFC2D9",
  },
  infoTitle: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: "800",
    color: colors.textInverse,
  },
  infoText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#DCE5EF",
  },
  searchBox: {
    minHeight: 48,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.navy[800],
  },
  clearText: {
    paddingHorizontal: 5,
    fontSize: 22,
    color: colors.textSoft,
  },
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
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 9,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: "700",
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
  casePressed: {
    opacity: 0.8,
  },
  caseTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  caseReference: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.royal[700],
  },
  caseTitle: {
    marginTop: 8,
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  caseDescription: {
    marginTop: 5,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 13,
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
  caseFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  openText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.royal[50],
  },
  statusBlue: {
    backgroundColor: colors.royal[50],
  },
  statusGold: {
    backgroundColor: colors.gold[50],
  },
  statusGreen: {
    backgroundColor: colors.teal[50],
  },
  statusGrey: {
    backgroundColor: colors.navy[50],
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
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
  priorityMedium: {
    backgroundColor: colors.royal[50],
  },
  priorityText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: colors.navy[700],
  },
  priorityUrgentText: {
    color: colors.error,
  },
  emptyCard: {
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyIconBox: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.royal[50],
  },
  emptyIcon: {
    fontSize: 24,
  },
  emptyTitle: {
    marginTop: 13,
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  emptyDescription: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
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
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.error,
  },
  retryText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textInverse,
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
  securityIcon: {
    marginRight: 9,
    fontSize: 15,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.teal[800],
  },
  securityText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});
