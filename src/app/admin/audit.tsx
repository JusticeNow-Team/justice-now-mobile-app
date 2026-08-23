import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuditEvent, AuditEventType, getAuditEvents } from "../../audit";
import { useAuth } from "../../auth";
import { RoleGuard } from "../../auth/guards/RoleGuard";
import { colors } from "../../theme";

type FilterTab = "ALL" | "ACCOUNT_CREATED" | "ACCOUNT_STATUS" | "ROLE_CHANGED";

export default function AdminAuditLogScreen() {
  const router = useRouter();
  const { role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const loadAuditEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAuditEvents(undefined, role || "system_admin");
      setEvents(data);
    } catch (err) {
      console.error("Failed to load audit events:", err);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAuditEvents();
  }, [loadAuditEvents]);

  const filteredEvents = useMemo(() => {
    let list = [...events];

    if (activeTab === "ACCOUNT_CREATED") {
      list = list.filter((e) => e.eventType === "ACCOUNT_CREATED");
    } else if (activeTab === "ACCOUNT_STATUS") {
      list = list.filter(
        (e) =>
          e.eventType === "ACCOUNT_ACTIVATED" ||
          e.eventType === "ACCOUNT_DEACTIVATED"
      );
    } else if (activeTab === "ROLE_CHANGED") {
      list = list.filter(
        (e) => e.eventType === "ROLE_CHANGED" || e.eventType === "ROLE_ASSIGNED"
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.actorEmail.toLowerCase().includes(q) ||
          e.targetEmail.toLowerCase().includes(q)
      );
    }

    return list;
  }, [events, activeTab, searchQuery]);

  const getEventBadge = (eventType: AuditEventType) => {
    switch (eventType) {
      case "ACCOUNT_CREATED":
        return {
          label: "Account Created",
          icon: "👤",
          bg: "#EEF3FA",
          text: "#1F4372",
          border: "#B5C8E1",
        };
      case "ACCOUNT_ACTIVATED":
        return {
          label: "Account Activated",
          icon: "✅",
          bg: "#ECFDF5",
          text: "#047857",
          border: "#A7F3D0",
        };
      case "ACCOUNT_DEACTIVATED":
        return {
          label: "Account Deactivated",
          icon: "⛔",
          bg: "#FEF2F2",
          text: "#B91C1C",
          border: "#FECACA",
        };
      case "ROLE_CHANGED":
      case "ROLE_ASSIGNED":
        return {
          label: "Role Changed",
          icon: "🔄",
          bg: "#FBF7EC",
          text: "#AF8722",
          border: "#E9D69D",
        };
      case "SECURITY_POLICY_VIOLATION":
        return {
          label: "Security Alert",
          icon: "🛡️",
          bg: "#FFFBEB",
          text: "#B45309",
          border: "#FDE68A",
        };
      default:
        return {
          label: eventType,
          icon: "📜",
          bg: "#F1F5F9",
          text: "#475569",
          border: "#CBD5E1",
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to Admin Dashboard"
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Account & Role Audit Log</Text>
            <Text style={styles.headerSubtitle}>
              Immutable administrative trace & tamper-proof history
            </Text>
          </View>

          <Pressable
            style={styles.refreshButton}
            onPress={() => void loadAuditEvents()}
            accessibilityRole="button"
            accessibilityLabel="Refresh audit log"
          >
            <Text style={styles.refreshButtonText}>🔄</Text>
          </Pressable>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by actor, target, or keyword..."
              placeholderTextColor={colors.textSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              accessibilityLabel="Search audit records"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Text style={styles.clearSearchText}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            <Pressable
              style={[
                styles.tabChip,
                activeTab === "ALL" && styles.tabChipActive,
              ]}
              onPress={() => setActiveTab("ALL")}
            >
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "ALL" && styles.tabChipTextActive,
                ]}
              >
                All Events ({events.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabChip,
                activeTab === "ACCOUNT_CREATED" && styles.tabChipActive,
              ]}
              onPress={() => setActiveTab("ACCOUNT_CREATED")}
            >
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "ACCOUNT_CREATED" && styles.tabChipTextActive,
                ]}
              >
                👤 Created
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabChip,
                activeTab === "ACCOUNT_STATUS" && styles.tabChipActive,
              ]}
              onPress={() => setActiveTab("ACCOUNT_STATUS")}
            >
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "ACCOUNT_STATUS" && styles.tabChipTextActive,
                ]}
              >
                ⚡ Activation Status
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabChip,
                activeTab === "ROLE_CHANGED" && styles.tabChipActive,
              ]}
              onPress={() => setActiveTab("ROLE_CHANGED")}
            >
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === "ROLE_CHANGED" && styles.tabChipTextActive,
                ]}
              >
                🔄 Role Changes
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Immutability Banner (AC 5 & AC 6) */}
        <View style={styles.securityBanner}>
          <Text style={styles.securityBannerIcon}>🔒</Text>
          <Text style={styles.securityBannerText}>
            Append-only tamper-proof audit trail. Passwords and credentials are automatically redacted.
          </Text>
        </View>

        {/* Audit Log Stream */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Loading audit logs...</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>No Audit Records Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "No audit records match your search criteria."
                : "No administrative events have been recorded for this filter."}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {filteredEvents.map((item) => {
              const badge = getEventBadge(item.eventType);
              return (
                <Pressable
                  key={item.id}
                  style={styles.eventCard}
                  onPress={() => setSelectedEvent(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect audit event ${item.action}`}
                >
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.eventBadge,
                        {
                          backgroundColor: badge.bg,
                          borderColor: badge.border,
                        },
                      ]}
                    >
                      <Text style={styles.badgeIcon}>{badge.icon}</Text>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>

                    <Text style={styles.timestampText}>
                      {formatDate(item.timestamp)}
                    </Text>
                  </View>

                  <Text style={styles.eventDescription}>
                    {item.description}
                  </Text>

                  {/* Actor & Target Row */}
                  <View style={styles.metadataGrid}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Actor:</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        👤 {item.actorEmail}
                      </Text>
                    </View>

                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Target:</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        🎯 {item.targetEmail}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.inspectHint}>
                      🔍 Tap to inspect metadata & payload →
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Detailed Event Inspection Modal */}
        <Modal
          visible={selectedEvent !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedEvent(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Audit Event Details</Text>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedEvent(null)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>

              {selectedEvent && (
                <ScrollView contentContainerStyle={styles.modalBody}>
                  {/* Event Type Header */}
                  <View
                    style={[
                      styles.modalBadgeBanner,
                      {
                        backgroundColor: getEventBadge(selectedEvent.eventType)
                          .bg,
                        borderColor: getEventBadge(selectedEvent.eventType)
                          .border,
                      },
                    ]}
                  >
                    <Text style={styles.modalBadgeText}>
                      {getEventBadge(selectedEvent.eventType).icon}{" "}
                      {getEventBadge(selectedEvent.eventType).label}
                    </Text>
                    <Text style={styles.modalTimestamp}>
                      {formatDate(selectedEvent.timestamp)}
                    </Text>
                  </View>

                  <Text style={styles.modalDescription}>
                    {selectedEvent.description}
                  </Text>

                  {/* Core Attribute Table */}
                  <View style={styles.detailTable}>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableKey}>Event ID</Text>
                      <Text style={styles.tableVal}>{selectedEvent.id}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableKey}>Action</Text>
                      <Text style={styles.tableVal}>{selectedEvent.action}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableKey}>Actor Email</Text>
                      <Text style={styles.tableVal}>{selectedEvent.actorEmail}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableKey}>Actor Role</Text>
                      <Text style={styles.tableVal}>{selectedEvent.actorRole}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableKey}>Target Email</Text>
                      <Text style={styles.tableVal}>{selectedEvent.targetEmail}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableKey}>IP Address</Text>
                      <Text style={styles.tableVal}>
                        {selectedEvent.ipAddress || "127.0.0.1"}
                      </Text>
                    </View>
                  </View>

                  {/* Payload Details */}
                  <View style={styles.payloadCard}>
                    <View style={styles.payloadHeader}>
                      <Text style={styles.payloadTitle}>
                        📦 Event Payload Details
                      </Text>
                      <View style={styles.redactionPill}>
                        <Text style={styles.redactionPillText}>
                          🛡️ Passwords Redacted
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.payloadJson}>
                      {JSON.stringify(selectedEvent.details, null, 2)}
                    </Text>
                  </View>

                  {/* Security Assurance */}
                  <View style={styles.immutableNotice}>
                    <Text style={styles.immutableNoticeText}>
                      🔒 This audit entry is permanently recorded. Modification or deletion is blocked by database security rules.
                    </Text>
                  </View>
                </ScrollView>
              )}

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.modalPrimaryButton}
                  onPress={() => setSelectedEvent(null)}
                >
                  <Text style={styles.modalPrimaryButtonText}>Close Viewer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 18,
    color: colors.navy[800],
    fontWeight: "700",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy[50],
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    fontSize: 15,
  },
  filterSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.navy[50],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  clearSearchText: {
    fontSize: 14,
    color: colors.textSoft,
    paddingHorizontal: 4,
  },
  tabsContainer: {
    gap: 8,
    paddingVertical: 2,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },
  tabChipTextActive: {
    color: colors.textInverse,
  },
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#BAE6FD",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  securityBannerIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  securityBannerText: {
    fontSize: 11.5,
    color: "#0369A1",
    fontWeight: "500",
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timestampText: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: "500",
  },
  eventDescription: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[900],
    lineHeight: 18,
    marginBottom: 10,
  },
  metadataGrid: {
    backgroundColor: colors.navy[50],
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 8,
  },
  metaCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textSecondary,
    width: 55,
  },
  metaValue: {
    fontSize: 11.5,
    color: colors.navy[800],
    flex: 1,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.navy[100],
    paddingTop: 8,
    alignItems: "flex-end",
  },
  inspectHint: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.royal[700],
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy[50],
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 14,
    color: colors.navy[800],
    fontWeight: "700",
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  modalBadgeBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBadgeText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  modalTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  modalDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[900],
    lineHeight: 20,
  },
  detailTable: {
    backgroundColor: colors.navy[50],
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tableKey: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tableVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[900],
    maxWidth: "60%",
    textAlign: "right",
  },
  payloadCard: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
  },
  payloadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  payloadTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  redactionPill: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  redactionPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#34D399",
  },
  payloadJson: {
    fontSize: 11.5,
    fontFamily: "monospace",
    color: "#E2E8F0",
  },
  immutableNotice: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  immutableNoticeText: {
    fontSize: 11,
    color: colors.textSoft,
    textAlign: "center",
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalPrimaryButton: {
    backgroundColor: colors.royal[700],
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalPrimaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
