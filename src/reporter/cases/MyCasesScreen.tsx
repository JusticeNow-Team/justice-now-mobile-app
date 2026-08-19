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

import {
  AppHeader,
  AppTextInput,
  EmptyState,
  Notice,
  PrimaryButton,
} from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { filterReporterCases } from "./filterReporterCases";
import { getReporterCases } from "./getReporterCases";
import ReporterCaseCard from "./ReporterCaseCard";
import {
  ACTIVE_STATUSES,
  CaseListTab,
  ReporterCase,
  ReporterCaseStatus,
  RESOLVED_STATUSES,
  STATUS_FILTERS,
  WAITING_STATUSES,
} from "./types";

export default function MyCasesScreen() {
  const router = useRouter();

  const [cases, setCases] = useState<ReporterCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<CaseListTab>("all");
  const [status, setStatus] = useState<"all" | ReporterCaseStatus>("all");

  const loadCases = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");
        const result = await getReporterCases();

        if (!result.ok) {
          if (result.reason === "unauthenticated") {
            await logoutReporter().catch(() => undefined);
            router.replace("/login");
            return;
          }

          setErrorMessage(result.message);
          setCases([]);
          return;
        }

        setCases(result.cases);
      } catch {
        setErrorMessage("We could not load your cases. Please try again.");
        setCases([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useFocusEffect(
    useCallback(() => {
      void loadCases(true);
    }, [loadCases])
  );

  const visibleCases = useMemo(
    () => filterReporterCases(cases, { tab, status, query }),
    [cases, tab, status, query]
  );

  const tabs: { id: CaseListTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: cases.length },
    {
      id: "active",
      label: "Active",
      count: cases.filter((item) => ACTIVE_STATUSES.includes(item.status)).length,
    },
    {
      id: "waiting",
      label: "Waiting",
      count: cases.filter((item) => WAITING_STATUSES.includes(item.status)).length,
    },
    {
      id: "resolved",
      label: "Resolved",
      count: cases.filter((item) => RESOLVED_STATUSES.includes(item.status)).length,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader
        title="My cases"
        subtitle={`${cases.length} report${cases.length === 1 ? "" : "s"} in your account`}
        onBack={() => router.replace("/reporter")}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadCases(false);
            }}
          />
        }
      >
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by reference, title or category"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search your cases"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          style={styles.tabsWrap}
        >
          {tabs.map((item) => {
            const active = tab === item.id;

            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {item.label}  {item.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {STATUS_FILTERS.map((item) => {
            const active = status === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => setStatus(item.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Loading securely…</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.block}>
            <Notice tone="error" title="Something went wrong">
              {errorMessage}
            </Notice>
            <View style={styles.retry}>
              <PrimaryButton title="Try again" onPress={() => void loadCases(true)} />
            </View>
          </View>
        ) : null}

        {!loading && !errorMessage && cases.length === 0 ? (
          <View style={styles.block}>
            <EmptyState
              title="No cases yet"
              body="When you report something, it will appear here so you can follow its progress."
              actionLabel="Report a case"
              onAction={() => router.push("/reporter/report/preference")}
            />
          </View>
        ) : null}

        {!loading && !errorMessage && cases.length > 0 && visibleCases.length === 0 ? (
          <View style={styles.block}>
            <EmptyState
              title="No matching cases"
              body="Try another case reference, or clear the status filter to see all of your reports."
            />
          </View>
        ) : null}

        {!loading && !errorMessage
          ? visibleCases.map((item) => (
              <View key={item.id} style={styles.cardWrap}>
                <ReporterCaseCard record={item} />
              </View>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  tabsWrap: {
    marginTop: 12,
  },
  tabs: {
    gap: 8,
    paddingBottom: 4,
  },
  tab: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[700],
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  chips: {
    gap: 8,
    marginTop: 10,
    paddingBottom: 4,
  },
  chip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.navy[300],
    backgroundColor: colors.navy[50],
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.navy[800],
    fontWeight: "600",
  },
  loading: {
    paddingTop: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
  },
  block: {
    marginTop: 16,
  },
  retry: {
    marginTop: 12,
  },
  cardWrap: {
    marginTop: 10,
  },
});
