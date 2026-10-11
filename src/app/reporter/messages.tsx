import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

import { AppIcon } from "../../components/AppIcon";
import { Notice, PrimaryButton } from "../../components/common";
import { colors, iconSizes } from "../../theme";
import { logoutReporter } from "../../reporter/login";
import { formatCaseDateTime } from "../../reporter/cases/filterReporterCases";
import { getReporterCases } from "../../reporter/cases/getReporterCases";
import { ReporterCase } from "../../reporter/cases/types";

export default function ReporterMessagesScreen() {
  const router = useRouter();
  const [cases, setCases] = useState<ReporterCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
        setErrorMessage("JusticeNow could not load your message inbox.");
        setCases([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      void loadCases(true);
      return undefined;
    }, [loadCases]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <AppIcon name="chevron-left" size={iconSizes.xl} color={colors.navy[700]} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Secure conversations by case</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadCases(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBox}>
          <AppIcon name="lock" size={iconSizes.sm} color={colors.teal[800]} />
          <Text style={styles.infoText}>
            Messages are attached to a case and visible only to authorised case staff.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.noticeWrap}>
            <Notice tone="error" title="Unable to load messages">
              {errorMessage}
            </Notice>
            <View style={styles.retry}>
              <PrimaryButton title="Try again" onPress={() => void loadCases(true)} />
            </View>
          </View>
        ) : null}

        {!loading && !errorMessage && cases.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="message-square" size={iconSizes.xl} color={colors.royal[700]} />
            <Text style={styles.emptyTitle}>No case messages yet</Text>
            <Text style={styles.emptyText}>
              Messages will appear after you submit a case or receive a staff reply.
            </Text>
          </View>
        ) : null}

        {!loading && !errorMessage
          ? cases.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: "/reporter/cases/[id]",
                    params: { id: item.id, tab: "messages" },
                  })
                }
                style={({ pressed }) => [
                  styles.messageCard,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open messages for ${item.caseReference}`}
              >
                <View style={styles.cardIcon}>
                  <AppIcon name="message-square" size={iconSizes.lg} color={colors.royal[700]} />
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.caseReference}>{item.caseReference}</Text>
                  <Text style={styles.caseTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.caseMeta}>
                    Last updated {formatCaseDateTime(item.updatedAt)}
                  </Text>
                </View>

                <AppIcon name="chevron-right" size={iconSizes.xl} color={colors.navy[400]} />
              </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.navy[800],
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  loading: {
    paddingTop: 42,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  noticeWrap: {
    marginTop: 14,
  },
  retry: {
    marginTop: 12,
  },
  emptyCard: {
    alignItems: "center",
    marginTop: 14,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy[800],
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  messageCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.75,
  },
  cardIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  caseReference: {
    fontSize: 11.5,
    color: colors.royal[700],
  },
  caseTitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy[800],
  },
  caseMeta: {
    marginTop: 3,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
});
