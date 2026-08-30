import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "../components/AppIcon";
import { colors, iconSizes } from "../theme";
import { getMyVerificationHistory } from "./api";
import {
  EmptyState,
  ErrorCard,
  HistoryDecisionCard,
  LoadingState,
  QueueTab,
  ValidatorHeader,
} from "./components";
import { EvidenceDecision, VerificationHistoryItem } from "./types";

type HistoryFilter = "all" | EvidenceDecision;
type DateRange = "all" | "30" | "7";

const HISTORY_FILTER_NOW = Date.now();

const FILTERS: {
  value: HistoryFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  {
    value: "replacement_requested",
    label: "Replacement",
  },
  { value: "escalated", label: "Escalated" },
];

const DATE_RANGES: DateRange[] = ["all", "30", "7"];

export default function VerificationHistoryScreen() {
  const [history, setHistory] = useState<VerificationHistoryItem[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const [dateRange, setDateRange] = useState<DateRange>("30");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const loadHistory = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setErrorMessage("");

      setHistory(await getMyVerificationHistory());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load validation history.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
      return undefined;
    }, [loadHistory]),
  );

  const counts = useMemo(
    () => ({
      all: history.length,

      approved: history.filter((item) => item.decision === "approved").length,

      rejected: history.filter((item) => item.decision === "rejected").length,

      replacement_requested: history.filter(
        (item) => item.decision === "replacement_requested",
      ).length,

      escalated: history.filter((item) => item.decision === "escalated").length,
    }),
    [history],
  );

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();

    const days = dateRange === "all" ? null : Number(dateRange);

    return history.filter((item) => {
      const searchMatch =
        !query ||
        item.caseReference.toLowerCase().includes(query) ||
        item.evidenceTitle.toLowerCase().includes(query) ||
        item.evidenceId.toLowerCase().includes(query) ||
        (item.fileName ?? "").toLowerCase().includes(query);

      const decisionMatch = filter === "all" || item.decision === filter;

      const dateMatch =
        days === null ||
        HISTORY_FILTER_NOW - new Date(item.decidedAt).getTime() <=
          days * 24 * 60 * 60 * 1000;

      return searchMatch && decisionMatch && dateMatch;
    });
  }, [dateRange, filter, history, search]);

  const nextDateRange = () => {
    const index = DATE_RANGES.indexOf(dateRange);

    setDateRange(DATE_RANGES[(index + 1) % DATE_RANGES.length]);
  };

  if (loading) {
    return <LoadingState label="Loading validation history..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ValidatorHeader
        title="Validation history"
        subtitle="Your recorded evidence decisions"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.royal[700]}
            onRefresh={() => {
              setRefreshing(true);
              void loadHistory(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBox}>
          <AppIcon name="search" color={colors.textSecondary} size={16} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search evidence ID, case ID or file name"
            placeholderTextColor={colors.textSoft}
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.tabs}
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map((item) => (
            <QueueTab
              key={item.value}
              label={item.label}
              count={counts[item.value]}
              selected={filter === item.value}
              onPress={() => setFilter(item.value)}
            />
          ))}
        </ScrollView>

        <View style={styles.filterSummary}>
          <Pressable
            onPress={nextDateRange}
            style={({ pressed }) => [
              styles.filterButton,
              pressed && styles.pressed,
            ]}
          >
            <AppIcon name="sliders" color={colors.navy[700]} size={iconSizes.xs} />

            <Text style={styles.filterButtonText}>Filters</Text>
          </Pressable>

          <Text style={styles.filterText}>
            {dateRange === "all"
              ? "All dates"
              : dateRange === "30"
                ? "Last 30 days"
                : "Last 7 days"}{" "}
            · your decisions
          </Text>
        </View>

        {errorMessage ? <ErrorCard message={errorMessage} /> : null}

        {!errorMessage && filteredHistory.length === 0 ? (
          <EmptyState
            title="No matching decisions"
            body="Completed verification decisions will appear here as read-only audit history."
          />
        ) : null}

        <View style={styles.list}>
          {filteredHistory.map((item) => (
            <HistoryDecisionCard key={item.decisionId} item={item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  pressed: {
    opacity: 0.66,
  },
  searchBox: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    fontSize: 14,
    color: colors.navy[800],
  },
  tabs: {
    marginTop: 12,
    gap: 8,
    paddingBottom: 4,
    paddingRight: 12,
  },
  filterSummary: {
    marginTop: 7,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },
  filterText: {
    flex: 1,
    fontSize: 11.5,
    textAlign: "right",
    color: colors.textSecondary,
  },
  list: {
    gap: 10,
  },
});
