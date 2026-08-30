import { Href, useFocusEffect, useRouter } from "expo-router";

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

import { getMyAssignedEvidence, getMyVerificationHistory } from "./api";

import {
  EmptyState,
  ErrorCard,
  EvidenceQueueCard,
  FilterChip,
  HistoryDecisionCard,
  LoadingState,
  QueueTab,
  ValidatorHeader,
} from "./components";

import { ValidatorEvidenceItem, VerificationHistoryItem } from "./types";

type QueueTabValue =
  | "pending"
  | "under_review"
  | "flagged"
  | "approved"
  | "rejected";

type DateFilter = "any" | "today" | "week";

const TABS: {
  value: QueueTabValue;
  label: string;
}[] = [
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "under_review",
    label: "Under review",
  },
  {
    value: "flagged",
    label: "Flagged",
  },
  {
    value: "approved",
    label: "Approved",
  },
  {
    value: "rejected",
    label: "Rejected",
  },
];

const FILE_TYPES = ["all", "document", "image", "audio", "video", "text"];

const PRIORITIES = ["all", "urgent", "high", "medium", "low"];

const DATES: DateFilter[] = ["any", "today", "week"];

function isFlagged(item: ValidatorEvidenceItem) {
  return (
    item.validationStatus === "flagged" ||
    !item.storageBucket ||
    !item.storagePath ||
    !item.mimeType ||
    item.fileSizeBytes === null
  );
}

function nextValue<T>(values: readonly T[], value: T) {
  const index = values.indexOf(value);

  return values[(index + 1) % values.length];
}

function matchesDate(value: string, filter: DateFilter) {
  if (filter === "any") {
    return true;
  }

  const age = Date.now() - new Date(value).getTime();

  const days = age / (24 * 60 * 60 * 1000);

  return filter === "today" ? days <= 1 : days <= 7;
}

export default function AssignedEvidenceScreen() {
  const router = useRouter();

  const [assignments, setAssignments] = useState<ValidatorEvidenceItem[]>([]);

  const [history, setHistory] = useState<VerificationHistoryItem[]>([]);

  const [tab, setTab] = useState<QueueTabValue>("pending");

  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [priority, setPriority] = useState("all");

  const [dateFilter, setDateFilter] = useState<DateFilter>("any");

  const [category, setCategory] = useState("all");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const loadQueue = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setErrorMessage("");

      const [queueRows, historyRows] = await Promise.all([
        getMyAssignedEvidence(),
        getMyVerificationHistory(),
      ]);

      setAssignments(queueRows);
      setHistory(historyRows);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load assigned evidence.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();

      return undefined;
    }, [loadQueue]),
  );

  const categories = useMemo(
    () => [
      "all",
      ...Array.from(new Set(assignments.map((item) => item.caseCategory))),
    ],
    [assignments],
  );

  const tabCounts = useMemo(
    () => ({
      pending: assignments.filter(
        (item) => item.assignmentStatus === "assigned",
      ).length,

      under_review: assignments.filter(
        (item) => item.assignmentStatus === "under_review",
      ).length,

      flagged: assignments.filter(isFlagged).length,

      approved: history.filter((item) => item.decision === "approved").length,

      rejected: history.filter((item) => item.decision === "rejected").length,
    }),
    [assignments, history],
  );

  const visibleAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((item) => {
      const tabMatch =
        tab === "flagged"
          ? isFlagged(item)
          : tab === "pending"
            ? item.assignmentStatus === "assigned"
            : tab === "under_review"
              ? item.assignmentStatus === "under_review"
              : false;

      const searchMatch =
        !query ||
        item.evidenceId.toLowerCase().includes(query) ||
        item.caseReference.toLowerCase().includes(query) ||
        item.caseTitle.toLowerCase().includes(query) ||
        item.evidenceTitle.toLowerCase().includes(query) ||
        (item.fileName ?? "").toLowerCase().includes(query);

      const typeMatch = fileType === "all" || item.evidenceType === fileType;

      const priorityMatch =
        priority === "all" || item.casePriority === priority;

      const categoryMatch =
        category === "all" || item.caseCategory === category;

      return (
        tabMatch &&
        searchMatch &&
        typeMatch &&
        priorityMatch &&
        categoryMatch &&
        matchesDate(item.assignedAt, dateFilter)
      );
    });
  }, [assignments, category, dateFilter, fileType, priority, search, tab]);

  const visibleHistory = useMemo(() => {
    if (tab !== "approved" && tab !== "rejected") {
      return [];
    }

    const query = search.trim().toLowerCase();

    return history.filter((item) => {
      const searchMatch =
        !query ||
        item.evidenceId.toLowerCase().includes(query) ||
        item.caseReference.toLowerCase().includes(query) ||
        item.evidenceTitle.toLowerCase().includes(query) ||
        (item.fileName ?? "").toLowerCase().includes(query);

      return (
        item.decision === tab &&
        searchMatch &&
        matchesDate(item.decidedAt, dateFilter)
      );
    });
  }, [dateFilter, history, search, tab]);

  const activeFilterCount = [
    fileType !== "all",
    priority !== "all",
    dateFilter !== "any",
    category !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFileType("all");
    setPriority("all");
    setDateFilter("any");
    setCategory("all");
  };

  if (loading) {
    return <LoadingState label="Loading validation queue..." />;
  }

  const empty = visibleAssignments.length === 0 && visibleHistory.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ValidatorHeader
        title="Validation queue"
        subtitle="Evidence assigned to you"
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
              void loadQueue(false);
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
          {TABS.map((item) => (
            <QueueTab
              key={item.value}
              label={item.label}
              count={tabCounts[item.value]}
              selected={tab === item.value}
              onPress={() => setTab(item.value)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          contentContainerStyle={styles.filters}
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            onPress={clearFilters}
            style={({ pressed }) => [
              styles.filtersButton,
              pressed && styles.pressed,
            ]}
          >
            <AppIcon name="sliders" color={colors.navy[700]} size={iconSizes.xs} />

            <Text style={styles.filtersButtonText}>
              Filters
              {activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Text>
          </Pressable>

          <FilterChip
            label={`File type: ${fileType === "all" ? "All" : fileType}`}
            selected={fileType !== "all"}
            onPress={() => setFileType(nextValue(FILE_TYPES, fileType))}
          />

          <FilterChip
            label={`Priority: ${priority === "all" ? "All" : priority}`}
            selected={priority !== "all"}
            onPress={() => setPriority(nextValue(PRIORITIES, priority))}
          />

          <FilterChip
            label={`Date: ${
              dateFilter === "any"
                ? "Any"
                : dateFilter === "today"
                  ? "Today"
                  : "7 days"
            }`}
            selected={dateFilter !== "any"}
            onPress={() => setDateFilter(nextValue(DATES, dateFilter))}
          />

          <FilterChip
            label={`Case category: ${category === "all" ? "All" : category}`}
            selected={category !== "all"}
            onPress={() => setCategory(nextValue(categories, category))}
          />
        </ScrollView>

        {errorMessage ? <ErrorCard message={errorMessage} /> : null}

        {!errorMessage && empty ? (
          <EmptyState
            title="No evidence in this view"
            body="Try another tab or clear the active filters."
          />
        ) : null}

        <View style={styles.list}>
          {visibleAssignments.map((item) => (
            <EvidenceQueueCard
              key={item.assignmentId}
              item={item}
              flagged={tab === "flagged"}
              onPress={() =>
                router.push(`/validator/evidence/${item.assignmentId}` as Href)
              }
            />
          ))}

          {visibleHistory.map((item) => (
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

  filters: {
    marginTop: 6,
    gap: 8,
    paddingBottom: 4,
    paddingRight: 12,
  },

  filtersButton: {
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

  filtersButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },

  list: {
    marginTop: 10,
    gap: 10,
  },
});
