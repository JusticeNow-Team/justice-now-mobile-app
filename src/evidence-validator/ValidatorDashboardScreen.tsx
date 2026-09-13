import { Image } from "expo-image";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "../components/AppIcon";
import { colors } from "../theme";
import { getValidatorDashboard } from "./api";
import {
  cardShadow,
  EmptyState,
  ErrorCard,
  EvidenceQueueCard,
  LoadingState,
} from "./components";
import { ValidatorDashboardData, ValidatorEvidenceItem } from "./types";

const logo = require("../../assets/images/justicenow-logo-mark.png");

function isFlagged(item: ValidatorEvidenceItem) {
  return (
    item.validationStatus === "flagged" ||
    !item.storageBucket ||
    !item.storagePath ||
    !item.mimeType ||
    item.fileSizeBytes === null
  );
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export default function ValidatorDashboardScreen() {
  const router = useRouter();

  const [data, setData] = useState<ValidatorDashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setErrorMessage("");
      setData(await getValidatorDashboard());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load the validation dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();

      return undefined;
    }, [loadDashboard]),
  );

  const metrics = useMemo(() => {
    const queue = data?.queue ?? [];
    const history = data?.history ?? [];

    return {
      pending: queue.length,

      high: queue.filter(
        (item) =>
          item.casePriority === "high" || item.casePriority === "urgent",
      ).length,

      flagged: queue.filter(isFlagged).length,

      replacements: history.filter(
        (item) => item.decision === "replacement_requested",
      ).length,

      today: history.filter((item) => isToday(item.decidedAt)).length,
    };
  }, [data]);

  if (loading && !data) {
    return <LoadingState label="Loading validation workspace..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.royal[700]}
            onRefresh={() => {
              setRefreshing(true);
              void loadDashboard(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.identity}>
              <Image source={logo} contentFit="contain" style={styles.logo} />

              <View style={styles.identityText}>
                <Text style={styles.heroLabel}>Evidence validation</Text>

                <Text style={styles.heroName} numberOfLines={1}>
                  {data?.validatorName ?? "Evidence Validator"}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push("/validator/notifications" as any)}
              style={({ pressed }) => [
                styles.bellButton,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon name="bell" color={colors.surface} size={20} />

              {metrics.flagged > 0 ? <View style={styles.bellDot} /> : null}
            </Pressable>
          </View>

          <Text style={styles.heroNotice}>
            <Text style={styles.heroNoticeStrong}>
              {metrics.flagged > 0
                ? `${metrics.flagged} file${
                    metrics.flagged === 1 ? " is" : "s are"
                  } flagged`
                : "No files are currently flagged"}
            </Text>{" "}
            {metrics.flagged > 0
              ? "by completeness checks and need a human decision before the investigation can continue."
              : "and your remaining assigned files are ready for human validation."}
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Pending validation"
            value={metrics.pending}
            tone="info"
          />

          <MetricCard
            label="High priority"
            value={metrics.high}
            tone="warning"
          />

          <MetricCard label="Flagged" value={metrics.flagged} tone="danger" />

          <MetricCard
            label="Replacement requested"
            value={metrics.replacements}
            tone="warning"
          />

          <MetricCard
            label="Validated today"
            value={metrics.today}
            tone="success"
          />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Next in your queue</Text>

          <Pressable onPress={() => router.push("/validator/queue")}>
            <Text style={styles.sectionAction}>Open queue</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={styles.horizontalPadding}>
            <ErrorCard message={errorMessage} />
          </View>
        ) : null}

        {!errorMessage && data?.queue.length === 0 ? (
          <View style={styles.horizontalPadding}>
            <EmptyState
              title="Your queue is clear"
              body="New evidence assigned by a Case Officer will appear here automatically."
            />
          </View>
        ) : null}

        <View style={styles.queueList}>
          {data?.queue.slice(0, 3).map((item) => (
            <EvidenceQueueCard
              key={item.assignmentId}
              item={item}
              flagged={isFlagged(item)}
              onPress={() =>
                router.push(`/validator/evidence/${item.assignmentId}` as Href)
              }
            />
          ))}
        </View>

        <View style={styles.safetyWrap}>
          <View style={styles.safetyCard}>
            <AppIcon name="shield-check" color={colors.navy[700]} size={14} />

            <View style={styles.safetyCopy}>
              <Text style={styles.safetyTitle}>
                Handling distressing material
              </Text>

              <Text style={styles.safetyText}>
                You can pause a review at any time. Use the hidden preview
                control and speak to your supervisor if content is affecting
                you.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "warning" | "danger" | "success";
}) {
  const toneColor = {
    info: colors.info,
    warning: colors.warning,
    danger: colors.error,
    success: colors.success,
  }[tone];

  return (
    <View style={[styles.metricCard, cardShadow]}>
      <View style={styles.metricLabelRow}>
        <View style={[styles.metricDot, { backgroundColor: toneColor }]} />

        <Text style={styles.metricLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>

      <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
    </View>
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
    paddingBottom: 20,
  },

  pressed: {
    opacity: 0.68,
  },

  hero: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: colors.navy[900],
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  logo: {
    width: 30,
    height: 30,
  },

  identityText: {
    flex: 1,
    minWidth: 0,
  },

  heroLabel: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.navy[300],
  },

  heroName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.surface,
  },

  bellButton: {
    position: "relative",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },

  bellDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderWidth: 2,
    borderColor: colors.navy[900],
    borderRadius: 4,
    backgroundColor: colors.gold[400],
  },

  heroNotice: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[100],
    backgroundColor: colors.navy[800],
  },

  heroNoticeStrong: {
    fontWeight: "600",
    color: colors.surface,
  },

  metricsGrid: {
    marginTop: -16,
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  metricCard: {
    width: "48.5%",
    minHeight: 85,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  metricLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    color: colors.textSecondary,
  },

  metricValue: {
    marginTop: 7,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "700",
  },

  sectionHeading: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    color: colors.textSecondary,
  },

  sectionAction: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.royal[700],
  },

  horizontalPadding: {
    paddingHorizontal: 16,
  },

  queueList: {
    paddingHorizontal: 16,
    gap: 10,
  },

  safetyWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  safetyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.navy[100],
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },

  safetyCopy: {
    flex: 1,
  },

  safetyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[700],
  },

  safetyText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[700],
  },
});
