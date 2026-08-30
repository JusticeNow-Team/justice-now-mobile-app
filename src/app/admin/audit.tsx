import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuditEvent, getAuditEvents } from "../../audit";
import { useAuth } from "../../auth";
import { AppIcon } from "../../components/AppIcon";
import { colors, iconSizes } from "../../theme";

type AuditResult = "Success" | "Failure";
type AuditTab = "all" | "success" | "failure";

const FILTERS = [
  "User: All",
  "Role: All",
  "Action: All",
  "Date: Last 7 days",
  "Result: All",
];

function formatAction(action?: string): string {
  if (!action) {
    return "Audit activity";
  }

  const knownActions: Record<string, string> = {
    STAFF_INVITE: "Staff invite",
    STAFF_INVITED: "Staff invited",
    STAFF_CREATE: "Staff account created",
    STAFF_CREATED: "Staff account created",
    STAFF_ACTIVATION: "Staff activation",
    STAFF_ACTIVATE: "Staff activated",
    STAFF_DEACTIVATION: "Staff deactivation",
    STAFF_DEACTIVATE: "Staff deactivated",
    STAFF_ROLE_CHANGE: "Staff role changed",
    ROLE_CHANGE: "Role changed",
    ROLE_CHANGED: "Role changed",
    CASE_STATUS_CHANGE: "Case status updated",
    CASE_STATUS_UPDATED: "Case status updated",
    EVIDENCE_APPROVED: "Evidence approved",
    EVIDENCE_REJECTED: "Evidence rejected",
    BULK_FILE_ACCESS: "Bulk file access",
    SIGN_IN_ATTEMPT: "Sign-in attempt",
    LOGIN_ATTEMPT: "Sign-in attempt",
    LOGIN_SUCCESS: "Successful sign-in",
    LOGIN_FAILED: "Failed sign-in",
    NIGHTLY_BACKUP_COMPLETED: "Nightly backup completed",
    SECURITY_POLICY_VIOLATION: "Security policy violation",
  };

  const normalized = action.trim().toUpperCase();

  if (knownActions[normalized]) {
    return knownActions[normalized];
  }

  const readable = action
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function formatRole(role?: string | null): string {
  if (!role) {
    return "-";
  }

  const roles: Record<string, string> = {
    system_admin: "System administrator",
    admin: "Administrator",
    case_officer: "Case officer",
    investigator: "Investigator",
    evidence_checker: "Validator",
    evidence_validator: "Validator",
    validator: "Validator",
    reporter: "Reporter",
  };

  return (
    roles[role.toLowerCase()] ??
    role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return "Unknown date";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart} · ${timePart}`;
}

function getResult(event: AuditEvent): AuditResult {
  const failureTypes = [
    "SECURITY_POLICY_VIOLATION",
    "LOGIN_FAILED",
    "SIGN_IN_FAILED",
    "FAILED_LOGIN",
    "ACCESS_DENIED",
    "UNAUTHORIZED_ACCESS",
  ];

  const eventType = String(event.eventType ?? "").toUpperCase();
  const action = String(event.action ?? "").toUpperCase();

  if (
    failureTypes.some(
      (type) => eventType.includes(type) || action.includes(type),
    )
  ) {
    return "Failure";
  }

  return "Success";
}

function getActor(event: AuditEvent): string {
  return event.actorEmail || event.actorId || event.targetEmail || "System";
}

function getResource(event: AuditEvent): string {
  return event.targetId || event.targetEmail || event.actorId || event.id || "-";
}

export default function AuditLogsScreen() {
  const { role } = useAuth();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedTab, setSelectedTab] = useState<AuditTab>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAuditEvents() {
      try {
        setLoading(true);
        setLoadError("");

        const auditEvents = await getAuditEvents(undefined, role || "system_admin");

        if (mounted) {
          setEvents(auditEvents ?? []);
        }
      } catch (error) {
        console.error("Unable to load audit events:", error);

        if (mounted) {
          setLoadError("Unable to load audit logs.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadAuditEvents();

    return () => {
      mounted = false;
    };
  }, [role]);

  const successCount = useMemo(
    () => events.filter((event) => getResult(event) === "Success").length,
    [events],
  );

  const failureCount = useMemo(
    () => events.filter((event) => getResult(event) === "Failure").length,
    [events],
  );

  const visibleEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return events.filter((event) => {
      const result = getResult(event);

      if (selectedTab === "success" && result !== "Success") {
        return false;
      }

      if (selectedTab === "failure" && result !== "Failure") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValue = [
        formatAction(event.action),
        event.action,
        event.eventType,
        event.actorEmail,
        event.actorId,
        event.actorRole,
        event.targetId,
        event.targetEmail,
        event.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableValue.includes(normalizedSearch);
    });
  }, [events, search, selectedTab]);

  const tabs: { id: AuditTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: events.length },
    { id: "success", label: "Success", count: successCount },
    { id: "failure", label: "Failure", count: failureCount },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            onPress={() => router.replace("/admin")}
          >
            <AppIcon name="chevron-left" size={iconSizes.headerBack} color={colors.navy[700]} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Audit logs</Text>
            <Text style={styles.headerSubtitle}>
              Every action, permanently recorded
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export audit log"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            onPress={() => {
              console.log("Export audit log");
            }}
          >
            <AppIcon name="download" size={iconSizes.md} color={colors.navy[700]} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.searchContainer}>
            <AppIcon name="search" size={iconSizes.sm} color={colors.textSecondary} />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search user, action or resource"
              placeholderTextColor="#8190A9"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />

            {search.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearch("")}
                hitSlop={8}
              >
                <AppIcon name="x" size={iconSizes.sm} color={colors.textSoft} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => {
              const selected = selectedTab === tab.id;

              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setSelectedTab(tab.id)}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.selectedTab,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.tabText, selected && styles.selectedTabText]}>
                    {tab.label} {tab.count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <Pressable style={styles.primaryFilter}>
              <AppIcon name="filter" size={iconSizes.sm} color={colors.navy[700]} />
              <Text style={styles.primaryFilterText}>Filters</Text>
            </Pressable>

            {FILTERS.map((filter) => (
              <Pressable key={filter} style={styles.filter}>
                <Text style={styles.filterText}>{filter}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.messageContainer}>
              <ActivityIndicator size="small" color={colors.royal[700]} />
              <Text style={styles.messageText}>Loading audit logs...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.messageContainer}>
              <AppIcon name="alert-circle" size={iconSizes.xl} color={colors.error} />
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : visibleEvents.length === 0 ? (
            <View style={styles.messageContainer}>
              <AppIcon name="document" size={iconSizes.xl} color={colors.textSoft} />
              <Text style={styles.messageText}>
                No matching audit entries found.
              </Text>
            </View>
          ) : (
            <View style={styles.auditList}>
              {visibleEvents.map((event) => {
                const result = getResult(event);

                return (
                  <Pressable
                    key={event.id}
                    style={({ pressed }) => [
                      styles.auditCard,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => router.push(`/admin/audit/${event.id}` as never)}
                  >
                    <View style={styles.auditDetails}>
                      <Text style={styles.timestamp}>
                        {formatTimestamp(event.timestamp)}
                      </Text>

                      <Text style={styles.action}>{formatAction(event.action)}</Text>

                      <Text style={styles.actor} numberOfLines={1}>
                        {getActor(event)} · {formatRole(event.actorRole)}
                      </Text>

                      <Text style={styles.resource} numberOfLines={1}>
                        {getResource(event)}
                      </Text>
                    </View>

                    <View style={styles.cardRight}>
                      <View
                        style={[
                          styles.resultBadge,
                          result === "Success"
                            ? styles.successBadge
                            : styles.failureBadge,
                        ]}
                      >
                        <View
                          style={[
                            styles.resultDot,
                            result === "Success"
                              ? styles.successDot
                              : styles.failureDot,
                          ]}
                        />

                        <Text
                          style={[
                            styles.resultText,
                            result === "Success"
                              ? styles.successText
                              : styles.failureText,
                          ]}
                        >
                          {result}
                        </Text>
                      </View>

                      <AppIcon name="chevron-right" size={iconSizes.sm} color={colors.navy[300]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.retentionText}>
            Audit entries cannot be edited or deleted. Retention: 7 years.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  screen: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#DCE4EF",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    paddingHorizontal: 3,
  },
  headerTitle: {
    color: "#102A4C",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 1,
    color: "#526783",
    fontSize: 11.5,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.68,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  searchContainer: {
    minHeight: 44,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#AFC2DD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 0,
    color: "#183153",
    fontSize: 13,
  },
  tabs: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tab: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE4EF",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  selectedTab: {
    borderColor: "#102A4C",
    backgroundColor: "#102A4C",
  },
  tabText: {
    color: "#183153",
    fontSize: 12,
    fontWeight: "700",
  },
  selectedTabText: {
    color: "#FFFFFF",
  },
  filters: {
    paddingTop: 11,
    paddingBottom: 4,
    gap: 8,
  },
  primaryFilter: {
    minHeight: 34,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#C6D4E6",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  primaryFilterText: {
    color: "#183153",
    fontSize: 12,
    fontWeight: "700",
  },
  filter: {
    minHeight: 34,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE4EF",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  filterText: {
    color: "#526783",
    fontSize: 12,
    fontWeight: "500",
  },
  auditList: {
    marginTop: 10,
    gap: 10,
  },
  auditCard: {
    minHeight: 104,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#DCE4EF",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#102A4C",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.035,
    shadowRadius: 5,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.76,
    borderColor: "#91AFE6",
  },
  auditDetails: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  timestamp: {
    color: "#647792",
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  action: {
    marginTop: 2,
    color: "#102A4C",
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  actor: {
    marginTop: 1,
    color: "#60738F",
    fontSize: 12,
    lineHeight: 17,
  },
  resource: {
    marginTop: 4,
    color: "#174EB6",
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cardRight: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  resultBadge: {
    minHeight: 27,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 9,
  },
  successBadge: {
    borderColor: "#C9E7DA",
    backgroundColor: "#EDF8F3",
  },
  failureBadge: {
    borderColor: "#F2CFCB",
    backgroundColor: "#FFF1EF",
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  successDot: {
    backgroundColor: "#14845C",
  },
  failureDot: {
    backgroundColor: "#C2413B",
  },
  resultText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  successText: {
    color: "#147453",
  },
  failureText: {
    color: "#B63A35",
  },
  retentionText: {
    marginTop: 14,
    color: "#647792",
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
  },
  messageContainer: {
    minHeight: 180,
    marginTop: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#DCE4EF",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  messageText: {
    color: "#647792",
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: "#B63A35",
    fontSize: 13,
    textAlign: "center",
  },
});
