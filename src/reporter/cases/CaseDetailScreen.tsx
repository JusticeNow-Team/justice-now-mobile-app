import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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

import {
  AppHeader,
  DataRow,
  EmptyState,
  Notice,
  PrimaryButton,
  SectionCard,
} from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { profileInitials } from "../profile/types";
import { formatCaseDate, formatCaseDateTime } from "./filterReporterCases";
import {
  formatEvidenceSize,
  getReporterCaseDetail,
  ReporterCaseDetail,
  ReporterEvidenceRecord,
  ReporterInformationRequest,
  ReporterOfficerPublic,
  ReporterStatusEvent,
} from "./getReporterCaseDetail";
import ReporterStatusBadge from "./ReporterStatusBadge";

type DetailTab = "overview" | "progress" | "requests" | "evidence" | "activity";

function splitDescription(value: string | null) {
  if (!value) {
    return {
      summary: "No description was provided.",
      extra: "",
    };
  }

  const [summary, extra] = value.split("--- Additional details ---");

  return {
    summary: summary.trim() || "No description was provided.",
    extra: extra?.trim() ?? "",
  };
}

function formatStatusLabel(value: string | null) {
  if (!value) {
    return "—";
  }

  return value.replace(/_/g, " ");
}

function formatEvidenceStatus(value: string) {
  return value.replace(/_/g, " ");
}

export default function CaseDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const caseId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [tab, setTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detail, setDetail] = useState<ReporterCaseDetail | null>(null);
  const [officer, setOfficer] = useState<ReporterOfficerPublic | null>(null);
  const [evidence, setEvidence] = useState<ReporterEvidenceRecord[]>([]);
  const [history, setHistory] = useState<ReporterStatusEvent[]>([]);
  const [informationRequests, setInformationRequests] = useState<
    ReporterInformationRequest[]
  >([]);

  const loadDetail = useCallback(
    async (showLoader = true) => {
      if (!caseId) {
        setErrorMessage("Case ID is missing.");
        setLoading(false);
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");

        const result = await getReporterCaseDetail(caseId);

        if (!result.ok) {
          if (result.reason === "unauthenticated") {
            await logoutReporter().catch(() => undefined);
            router.replace("/login");
            return;
          }

          setDetail(null);
          setErrorMessage(result.message);
          return;
        }

        setDetail(result.detail);
        setOfficer(result.officer);
        setEvidence(result.evidence);
        setHistory(result.history);
        setInformationRequests(result.informationRequests);
      } catch {
        setErrorMessage(
          "JusticeNow could not load this case. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [caseId, router],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDetail(true);
    }, [loadDetail]),
  );

  const description = splitDescription(detail?.description ?? null);

  const tabs: {
    id: DetailTab;
    label: string;
    count?: number;
  }[] = [
    {
      id: "overview",
      label: "Overview",
    },
    {
      id: "progress",
      label: "Progress",
    },
    {
      id: "requests",
      label: "Requests",
      count: informationRequests.length,
    },
    {
      id: "evidence",
      label: "Evidence",
      count: evidence.length,
    },
    {
      id: "activity",
      label: "Activity",
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader
        title={detail?.caseReference ?? "Case details"}
        subtitle={detail?.title}
        onBack={() => router.replace("/reporter/cases")}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.royal[700]} />

          <Text style={styles.loadingText}>Loading your case…</Text>
        </View>
      ) : null}

      {!loading && errorMessage ? (
        <View style={styles.padded}>
          <Notice tone="error" title="Unable to open this case">
            {errorMessage}
          </Notice>

          <View style={styles.retry}>
            <PrimaryButton
              title="Try again"
              onPress={() => void loadDetail(true)}
            />
          </View>
        </View>
      ) : null}

      {!loading && !errorMessage && detail ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadDetail(false);
              }}
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <Text style={styles.reference}>{detail.caseReference}</Text>

                <Text style={styles.heroTitle}>{detail.title}</Text>

                <Text style={styles.heroMeta}>
                  Submitted {formatCaseDateTime(detail.createdAt)}
                </Text>
              </View>

              <ReporterStatusBadge status={detail.status} />
            </View>
          </View>

          <View style={styles.tabRow}>
            {tabs.map((item) => {
              const active = tab === item.id;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {item.label}
                    {typeof item.count === "number" ? ` (${item.count})` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "overview" ? (
            <View style={styles.stack}>
              <SectionCard title="Incident details">
                <DataRow label="Category" value={detail.category || "—"} />

                <DataRow
                  label="Incident date"
                  value={formatCaseDate(detail.incidentDate)}
                />

                <DataRow
                  label="Location"
                  value={detail.district || "Not specified"}
                />

                <DataRow
                  label="Reporting mode"
                  value={detail.isAnonymous ? "Anonymous" : "With my identity"}
                />

                <DataRow
                  label="Current status"
                  value={formatStatusLabel(detail.status)}
                  last
                />

                <Text style={styles.description}>{description.summary}</Text>
              </SectionCard>

              <SectionCard title="Your case officer">
                {officer ? (
                  <>
                    <View style={styles.officerRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {profileInitials(officer.fullName)}
                        </Text>
                      </View>

                      <View style={styles.officerText}>
                        <Text style={styles.officerName}>
                          {officer.fullName}
                        </Text>

                        <Text style={styles.officerRole}>
                          {officer.roleLabel}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.officerNote}>
                      Personal contact details of officers are never shared. All
                      communication stays inside JusticeNow.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.officerRole}>
                    An investigator has not been assigned yet. You will see
                    their public name here when one is assigned.
                  </Text>
                )}
              </SectionCard>
            </View>
          ) : null}

          {tab === "progress" ? (
            <View style={styles.stack}>
              <SectionCard
                title="Progress timeline"
                description="Every stage your case moves through."
              >
                {history.length === 0 ? (
                  <Text style={styles.officerRole}>
                    Status updates will appear here as your case moves forward.
                  </Text>
                ) : (
                  history.map((event, index) => (
                    <View
                      key={event.id}
                      style={[
                        styles.timelineRow,
                        index === history.length - 1 && styles.timelineLast,
                      ]}
                    >
                      <Text style={styles.timelineTitle}>
                        {formatStatusLabel(event.toStatus)}
                      </Text>

                      <Text style={styles.timelineMeta}>
                        {formatCaseDateTime(event.changedAt)}
                        {event.fromStatus
                          ? ` · from ${formatStatusLabel(event.fromStatus)}`
                          : ""}
                      </Text>
                    </View>
                  ))
                )}
              </SectionCard>
            </View>
          ) : null}

          {tab === "requests" ? (
            <View style={styles.stack}>
              {informationRequests.length === 0 ? (
                <EmptyState
                  title="No information requests"
                  body="If your Case Officer needs more details, the secure request will appear here."
                />
              ) : (
                informationRequests.map((request) => (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <Text style={styles.requestStatus}>
                        {request.status === "responded"
                          ? "RESPONSE SUBMITTED"
                          : "RESPONSE NEEDED"}
                      </Text>

                      <Text style={styles.requestMeta}>
                        Due {formatCaseDate(request.dueDate)}
                      </Text>
                    </View>

                    <Text style={styles.requestTitle}>{request.title}</Text>

                    <Text style={styles.requestMessage}>{request.message}</Text>

                    <Text style={styles.requestMeta}>
                      {request.requestedItems.length}{" "}
                      {request.requestedItems.length === 1
                        ? "question"
                        : "questions"}
                      {request.requiresEvidence ? " · evidence requested" : ""}
                    </Text>

                    {request.response ? (
                      <View style={styles.responseBox}>
                        <Text style={styles.responseLabel}>
                          Submitted{" "}
                          {formatCaseDateTime(request.response.submittedAt)}
                        </Text>

                        {request.response.answers.map((answer, index) => (
                          <View
                            key={`${request.id}-${index}`}
                            style={styles.responseItem}
                          >
                            <Text style={styles.responseQuestion}>
                              {answer.question}
                            </Text>

                            <Text style={styles.responseAnswer}>
                              {answer.answer}
                            </Text>
                          </View>
                        ))}

                        {request.response.additionalMessage ? (
                          <Text style={styles.responseAnswer}>
                            {request.response.additionalMessage}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    <PrimaryButton
                      title={
                        request.status === "responded"
                          ? "View submitted response"
                          : "Respond securely"
                      }
                      variant={
                        request.status === "responded" ? "outline" : "primary"
                      }
                      onPress={() =>
                        router.push({
                          pathname: "/reporter/cases/information-request",
                          params: {
                            requestId: request.id,
                          },
                        })
                      }
                    />
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === "evidence" ? (
            <View style={styles.stack}>
              {evidence.length === 0 ? (
                <EmptyState
                  title="No evidence yet"
                  body="Files added to this case will appear here after they are uploaded and checked."
                />
              ) : (
                evidence.map((item) => (
                  <View key={item.id} style={styles.evidenceCard}>
                    <Text style={styles.evidenceType}>
                      {item.evidenceType.toUpperCase()}
                    </Text>

                    <Text style={styles.evidenceTitle}>
                      {item.fileName || item.title}
                    </Text>

                    <Text style={styles.evidenceMeta}>
                      {formatEvidenceSize(item.fileSizeBytes)} · uploaded{" "}
                      {formatCaseDate(item.createdAt)}
                    </Text>

                    <Text style={styles.evidenceStatus}>
                      {formatEvidenceStatus(item.validationStatus)}
                    </Text>
                  </View>
                ))
              )}

              <PrimaryButton
                title="Add more evidence"
                variant="outline"
                icon="⬆"
                onPress={() =>
                  router.push({
                    pathname: "/reporter/cases/upload",
                    params: {
                      caseId: detail.id,
                    },
                  })
                }
              />

              <Notice tone="privacy">
                Evidence is checked by a validator before it becomes part of the
                case record. You will be told if a replacement is needed.
              </Notice>
            </View>
          ) : null}

          {tab === "activity" ? (
            <View style={styles.stack}>
              <SectionCard
                title="Activity history"
                description="A record of everything that has happened."
              >
                {history.length === 0 ? (
                  <Text style={styles.officerRole}>
                    There is no public activity on this case yet.
                  </Text>
                ) : (
                  history
                    .slice()
                    .reverse()
                    .map((event) => (
                      <View key={event.id} style={styles.activityRow}>
                        <Text style={styles.timelineTitle}>
                          Status set to {formatStatusLabel(event.toStatus)}
                        </Text>

                        <Text style={styles.timelineMeta}>
                          {formatCaseDateTime(event.changedAt)}
                        </Text>
                      </View>
                    ))
                )}
              </SectionCard>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  padded: {
    padding: 16,
  },
  retry: {
    marginTop: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  hero: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  reference: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.royal[700],
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 16.5,
    fontWeight: "700",
    lineHeight: 22,
    color: colors.navy[800],
  },
  heroMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tabRow: {
    marginTop: 14,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.royal[700],
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.royal[700],
  },
  stack: {
    marginTop: 14,
    gap: 12,
  },
  description: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  officerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[100],
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },
  officerText: {
    flex: 1,
  },
  officerName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  officerRole: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  officerNote: {
    marginTop: 12,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  timelineRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.7)",
  },
  timelineLast: {
    borderBottomWidth: 0,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
    color: colors.navy[800],
  },
  timelineMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  activityRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.7)",
  },
  requestCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gold[100],
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  requestStatus: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.warning,
  },
  requestTitle: {
    marginTop: 9,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  requestMessage: {
    marginTop: 5,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  requestMeta: {
    fontSize: 10.5,
    color: colors.textSoft,
  },
  responseBox: {
    marginVertical: 12,
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.teal[50],
  },
  responseLabel: {
    marginBottom: 8,
    fontSize: 10,
    fontWeight: "700",
    color: colors.teal[800],
  },
  responseItem: {
    marginBottom: 8,
  },
  responseQuestion: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  responseAnswer: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.navy[800],
  },
  evidenceCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  evidenceType: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.royal[700],
  },
  evidenceTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  evidenceMeta: {
    marginTop: 4,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  evidenceStatus: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    color: colors.navy[700],
  },
});
