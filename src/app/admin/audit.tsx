import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import {
  AuditCategory,
  AuditEvent,
  AuditResultFilter,
  getPaginatedAuditEvents,
  PaginatedAuditResponse,
} from "../../audit";
import { useAuth } from "../../auth";
import { normalizeRole } from "../../auth/roles";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { colors } from "../../theme";

const CATEGORY_ITEMS: { id: AuditCategory; label: string; icon: AppIconName }[] = [
  { id: "all", label: "All Events", icon: "clipboard-check" },
  { id: "account", label: "Accounts", icon: "user" },
  { id: "role", label: "Roles", icon: "roles" },
  { id: "case", label: "Cases", icon: "document" },
  { id: "evidence", label: "Evidence", icon: "file-search" },
  { id: "status", label: "Statuses", icon: "settings" },
  { id: "security", label: "Security", icon: "shield-alert" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatAction(action?: string): string {
  if (!action) return "Audit Activity";

  const knownActions: Record<string, string> = {
    STAFF_INVITE: "Staff Invitation Sent",
    STAFF_INVITED: "Staff Invitation Sent",
    STAFF_CREATE: "Staff Account Created",
    STAFF_CREATED: "Staff Account Created",
    STAFF_ACTIVATION: "Staff Account Activated",
    STAFF_ACTIVATE: "Staff Account Activated",
    STAFF_DEACTIVATION: "Staff Account Suspended",
    STAFF_DEACTIVATE: "Staff Account Suspended",
    STAFF_ROLE_CHANGE: "Staff Role Modified",
    ROLE_ASSIGNED: "Staff Role Assigned",
    ROLE_CHANGED: "Staff Role Transitioned",
    CASE_SUBMITTED: "Case Report Submitted",
    CASE_CREATED: "Case Report Submitted",
    CASE_ASSIGNMENT: "Case Officer Assigned",
    CASE_ASSIGNED: "Case Officer Assigned",
    CASE_STATUS_CHANGE: "Case Workflow Status Updated",
    CASE_STATUS_CHANGED: "Case Workflow Status Updated",
    WITHDRAWAL_REVIEW_DECISION: "Case Withdrawal Reviewed",
    CASE_WITHDRAWAL_REVIEWED: "Case Withdrawal Reviewed",
    EVIDENCE_UPLOAD: "Forensic Evidence Uploaded",
    EVIDENCE_UPLOADED: "Forensic Evidence Uploaded",
    EVIDENCE_ASSIGNMENT: "Evidence Assigned to Checker",
    EVIDENCE_ASSIGNED: "Evidence Assigned to Checker",
    EVIDENCE_APPROVED: "Evidence Verified & Approved",
    EVIDENCE_VERIFIED: "Evidence Verified & Approved",
    EVIDENCE_REJECTED: "Evidence Evaluation Rejected",
    CLARIFICATION_REQUESTED: "Evidence Clarification Requested",
    EVIDENCE_CLARIFICATION_REQUESTED: "Evidence Clarification Requested",
    STATUS_CONFIG_CREATED: "Workflow Status Created",
    STATUS_CONFIG_UPDATED: "Workflow Status Updated",
    STATUS_CONFIG_ACTIVATED: "Workflow Status Activated",
    STATUS_CONFIG_DEACTIVATED: "Workflow Status Deactivated",
    STATUS_CONFIG_DELETED: "Workflow Status Deleted",
    CHECKER_STATUS_TOGGLED: "Checker Availability Toggled",
    CHECKER_AVAILABILITY_CHANGED: "Checker Availability Changed",
    LOGIN_SUCCESS: "Successful Authentication",
    LOGIN_FAILED: "Failed Login Attempt",
    SIGN_IN_ATTEMPT: "Authentication Attempt",
    UNAUTHORIZED_ACCESS_ATTEMPT: "Unauthorized Route Access Blocked",
    ACCESS_DENIED: "Access Denied (Insufficient Role)",
    BULK_FILE_ACCESS: "Anomalous Bulk File Access",
    UNUSUAL_FILE_ACCESS: "Anomalous Bulk File Access",
    SECURITY_POLICY_VIOLATION: "Security Policy Violation",
  };

  const normalized = action.trim().toUpperCase();
  if (knownActions[normalized]) return knownActions[normalized];

  const readable = action
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function formatRole(role?: string | null): string {
  if (!role) return "-";
  const roles: Record<string, string> = {
    system_admin: "System Administrator",
    admin: "Administrator",
    case_officer: "Case Officer",
    investigator: "Investigator",
    evidence_checker: "Evidence Checker",
    evidence_validator: "Evidence Checker",
    validator: "Evidence Checker",
    reporter: "Reporter",
  };

  return (
    roles[role.toLowerCase()] ??
    role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "Unknown date";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return `${datePart} · ${timePart} UTC`;
}

function getResult(event: AuditEvent): "Success" | "Failure" {
  const failureTypes = [
    "SECURITY_POLICY_VIOLATION",
    "LOGIN_FAILED",
    "SIGN_IN_FAILED",
    "FAILED_LOGIN",
    "ACCESS_DENIED",
    "UNAUTHORIZED_ACCESS",
    "UNAUTHORIZED_ACCESS_ATTEMPT",
    "REJECTED",
  ];

  const eventType = String(event.eventType ?? "").toUpperCase();
  const action = String(event.action ?? "").toUpperCase();

  if (failureTypes.some((type) => eventType.includes(type) || action.includes(type))) {
    return "Failure";
  }

  return "Success";
}

function getCategoryColor(category?: AuditCategory): { bg: string; text: string; icon: AppIconName } {
  switch (category) {
    case "account":
      return { bg: "#EBF2FC", text: colors.royal[700], icon: "user" };
    case "role":
      return { bg: "#F3E8FF", text: "#6B21A8", icon: "roles" };
    case "case":
      return { bg: "#EAF6F0", text: colors.success, icon: "document" };
    case "evidence":
      return { bg: "#FEF3C7", text: "#92400E", icon: "file-search" };
    case "status":
      return { bg: "#F0FDF4", text: "#166534", icon: "settings" };
    case "security":
      return { bg: "#FBEEEC", text: colors.error, icon: "shield-alert" };
    default:
      return { bg: colors.navy[50], text: colors.navy[700], icon: "clipboard-check" };
  }
}

export default function AuditLogsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isAuthorized = userRole === "system_admin";

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>("all");
  const [selectedResult, setSelectedResult] = useState<AuditResultFilter>("all");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");

  // Pagination states (AC 7 / JN-283)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data states
  const [data, setData] = useState<PaginatedAuditResponse>({
    events: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Inspection modal state (AC 2 & AC 5)
  const [inspectedEvent, setInspectedEvent] = useState<AuditEvent | null>(null);

  const loadAuditLogs = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError("");

      const response = await getPaginatedAuditEvents(
        {
          category: selectedCategory,
          result: selectedResult,
          searchQuery: search.trim() || undefined,
          actorEmail: userFilter.trim() || undefined,
          page,
          pageSize,
        },
        user?.role || "system_admin",
      );

      setData(response);
    } catch (error: any) {
      console.error("Unable to load audit events:", error);
      setLoadError(error?.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, selectedCategory, selectedResult, search, userFilter, page, pageSize, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAuditLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAuditLogs]);

  // Reset to page 1 on filter changes
  const handleCategoryChange = (cat: AuditCategory) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleResultChange = (res: AuditResultFilter) => {
    setSelectedResult(res);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedResult("all");
    setSearch("");
    setUserFilter("");
    setPage(1);
  };

  const hasActiveFilters =
    selectedCategory !== "all" || selectedResult !== "all" || search.length > 0 || userFilter.length > 0;

  // Compute metrics
  const metrics = useMemo(() => {
    const total = data.totalCount;
    return {
      total,
      page: data.page,
      totalPages: data.totalPages,
    };
  }, [data]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            onPress={() => router.replace("/admin")}
          >
            <AppIcon name="chevron-left" size={20} color={colors.navy[700]} />
          </Pressable>

          <View style={styles.headerIcon}>
            <AppIcon name="shield" size={20} color={colors.royal[700]} />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>System Audit Logs</Text>
            <Text style={styles.headerSubtitle}>
              Immutable action record · 7-year retention policy (JN-280 - JN-285)
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh audit log"
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            onPress={() => void loadAuditLogs()}
          >
            <AppIcon name="refresh-cw" size={18} color={colors.navy[700]} />
          </Pressable>
        </View>

        {/* Unauthorized Access Guard Notice (AC 1 & JN-284) */}
        {!isAuthorized ? (
          <View style={styles.unauthorizedNotice}>
            <AppIcon name="shield-alert" size={22} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.unauthorizedTitle}>Restricted System Audit Log (AC 1)</Text>
              <Text style={styles.unauthorizedText}>
                Access to the administrative audit log is strictly restricted to authorized System
                Administrators. Unauthorized access attempts are permanently audited.
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* KPI Metrics Row */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{metrics.total}</Text>
                <Text style={styles.kpiLabel}>Total Records</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: colors.success }]}>
                  {data.events.filter((e) => getResult(e) === "Success").length}
                </Text>
                <Text style={styles.kpiLabel}>Page Success</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: colors.error }]}>
                  {data.events.filter((e) => getResult(e) === "Failure").length}
                </Text>
                <Text style={styles.kpiLabel}>Page Alerts</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: colors.royal[700] }]}>
                  {data.pageSize}
                </Text>
                <Text style={styles.kpiLabel}>Per Page</Text>
              </View>
            </View>

            {/* Search Input Bar (AC 3) */}
            <View style={styles.searchContainer}>
              <AppIcon name="search" size={17} color={colors.textSecondary} />
              <TextInput
                value={search}
                onChangeText={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Search by action, actor, target ID, or keyword..."
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {search.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  hitSlop={8}
                >
                  <AppIcon name="x" size={16} color={colors.textSoft} />
                </Pressable>
              ) : null}
            </View>

            {/* Category Filter Chips (AC 4 / JN-282) */}
            <View style={styles.categorySection}>
              <Text style={styles.filterSectionTitle}>AUDIT CATEGORIES (AC 4)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChips}
              >
                {CATEGORY_ITEMS.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[styles.categoryChip, active && styles.activeCategoryChip]}
                      onPress={() => handleCategoryChange(cat.id)}
                    >
                      <AppIcon
                        name={cat.icon}
                        size={14}
                        color={active ? colors.textInverse : colors.navy[700]}
                      />
                      <Text
                        style={[styles.categoryChipText, active && styles.activeCategoryChipText]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Result Tabs & Reset Filter */}
            <View style={styles.resultFilterRow}>
              <View style={styles.tabs}>
                {(
                  [
                    { id: "all", label: "All Results" },
                    { id: "success", label: "Success Only" },
                    { id: "failure", label: "Alerts / Failures" },
                  ] as const
                ).map((tab) => {
                  const active = selectedResult === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => handleResultChange(tab.id)}
                      style={[styles.tab, active && styles.selectedTab]}
                    >
                      <Text style={[styles.tabText, active && styles.selectedTabText]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {hasActiveFilters && (
                <Pressable style={styles.clearFiltersBtn} onPress={handleClearFilters}>
                  <AppIcon name="refresh-cw" size={12} color={colors.royal[700]} />
                  <Text style={styles.clearFiltersText}>Reset</Text>
                </Pressable>
              )}
            </View>

            {/* Audit Log Entries List (AC 2 & JN-281) */}
            {loading ? (
              <View style={styles.messageContainer}>
                <ActivityIndicator size="small" color={colors.royal[700]} />
                <Text style={styles.messageText}>Loading system audit trail...</Text>
              </View>
            ) : loadError ? (
              <View style={styles.messageContainer}>
                <AppIcon name="alert-circle" size={24} color={colors.error} />
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
            ) : data.events.length === 0 ? (
              <View style={styles.messageContainer}>
                <AppIcon name="document" size={24} color={colors.textSoft} />
                <Text style={styles.messageText}>No matching audit entries found.</Text>
                <Text style={styles.subMessageText}>
                  Try adjusting search parameters or clearing active category filters.
                </Text>
              </View>
            ) : (
              <View style={styles.auditList}>
                {data.events.map((event) => {
                  const result = getResult(event);
                  const catStyle = getCategoryColor(event.category);

                  return (
                    <Pressable
                      key={event.id}
                      style={({ pressed }) => [styles.auditCard, pressed && styles.cardPressed]}
                      onPress={() => setInspectedEvent(event)}
                    >
                      {/* Left: Category Icon */}
                      <View style={[styles.eventCategoryBadge, { backgroundColor: catStyle.bg }]}>
                        <AppIcon name={catStyle.icon} size={18} color={catStyle.text} />
                      </View>

                      {/* Center: Details */}
                      <View style={styles.auditDetails}>
                        <View style={styles.cardHeaderRow}>
                          <Text style={styles.timestamp}>{formatTimestamp(event.timestamp)}</Text>
                          <View
                            style={[
                              styles.resultBadge,
                              result === "Success" ? styles.successBadge : styles.failureBadge,
                            ]}
                          >
                            <View
                              style={[
                                styles.resultDot,
                                result === "Success" ? styles.successDot : styles.failureDot,
                              ]}
                            />
                            <Text
                              style={[
                                styles.resultText,
                                result === "Success" ? styles.successText : styles.failureText,
                              ]}
                            >
                              {result.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Formatted Action Title */}
                        <Text style={styles.actionTitle}>{formatAction(event.action)}</Text>

                        {/* Description */}
                        <Text style={styles.eventDescription} numberOfLines={2}>
                          {event.description}
                        </Text>

                        {/* Attribution: Actor & Target */}
                        <View style={styles.attributionRow}>
                          <View style={styles.actorPill}>
                            <AppIcon name="user" size={11} color={colors.navy[600]} />
                            <Text style={styles.actorText} numberOfLines={1}>
                              {event.actorEmail} ({formatRole(event.actorRole)})
                            </Text>
                          </View>

                          <View style={styles.targetPill}>
                            <AppIcon name="arrow-right" size={10} color={colors.royal[700]} />
                            <Text style={styles.targetText} numberOfLines={1}>
                              {event.targetId || event.targetEmail}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Right: Chevron */}
                      <View style={styles.cardRightChevron}>
                        <AppIcon name="chevron-right" size={16} color={colors.navy[300]} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Pagination Controls (AC 7 / JN-283) */}
            {data.totalCount > 0 && (
              <View style={styles.paginationContainer}>
                <View style={styles.paginationSummaryRow}>
                  <Text style={styles.paginationSummary}>
                    Showing{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {(data.page - 1) * data.pageSize + 1}–
                      {Math.min(data.page * data.pageSize, data.totalCount)}
                    </Text>{" "}
                    of <Text style={{ fontWeight: "700" }}>{data.totalCount}</Text> entries
                  </Text>

                  {/* Page Size Selector */}
                  <View style={styles.pageSizeRow}>
                    <Text style={styles.pageSizeLabel}>Page Size:</Text>
                    {PAGE_SIZE_OPTIONS.map((sz) => (
                      <Pressable
                        key={sz}
                        style={[styles.pageSizeBtn, pageSize === sz && styles.activePageSizeBtn]}
                        onPress={() => {
                          setPageSize(sz);
                          setPage(1);
                        }}
                      >
                        <Text
                          style={[
                            styles.pageSizeBtnText,
                            pageSize === sz && styles.activePageSizeBtnText,
                          ]}
                        >
                          {sz}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Navigation Buttons */}
                <View style={styles.paginationNavRow}>
                  <Pressable
                    style={[styles.navBtn, data.page <= 1 && styles.disabledNavBtn]}
                    disabled={data.page <= 1}
                    onPress={() => setPage(1)}
                  >
                    <Text style={[styles.navBtnText, data.page <= 1 && styles.disabledNavBtnText]}>
                      « First
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.navBtn, data.page <= 1 && styles.disabledNavBtn]}
                    disabled={data.page <= 1}
                    onPress={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    <Text style={[styles.navBtnText, data.page <= 1 && styles.disabledNavBtnText]}>
                      ‹ Prev
                    </Text>
                  </Pressable>

                  <View style={styles.pageNumberBadge}>
                    <Text style={styles.pageNumberText}>
                      Page {data.page} of {data.totalPages}
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.navBtn, data.page >= data.totalPages && styles.disabledNavBtn]}
                    disabled={data.page >= data.totalPages}
                    onPress={() => setPage((p) => Math.min(p + 1, data.totalPages))}
                  >
                    <Text
                      style={[
                        styles.navBtnText,
                        data.page >= data.totalPages && styles.disabledNavBtnText,
                      ]}
                    >
                      Next ›
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.navBtn, data.page >= data.totalPages && styles.disabledNavBtn]}
                    disabled={data.page >= data.totalPages}
                    onPress={() => setPage(data.totalPages)}
                  >
                    <Text
                      style={[
                        styles.navBtnText,
                        data.page >= data.totalPages && styles.disabledNavBtnText,
                      ]}
                    >
                      Last »
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Immutability Retention Policy Banner (AC 6) */}
            <View style={styles.immutabilityNotice}>
              <AppIcon name="lock" size={16} color={colors.navy[600]} />
              <Text style={styles.retentionText}>
                Audit records are tamper-evident, strictly read-only, and permanent. Modifications
                and deletions are prohibited by cryptographic and RLS database rules. Retention: 7
                years.
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Detailed Event Inspection Modal (AC 2, AC 5, AC 6) */}
        <Modal
          visible={Boolean(inspectedEvent)}
          transparent
          animationType="fade"
          onRequestClose={() => setInspectedEvent(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Audit Event Inspection</Text>
                  <Text style={styles.modalSubtitle}>
                    ID: {inspectedEvent?.id} · {formatTimestamp(inspectedEvent?.timestamp)}
                  </Text>
                </View>
                <Pressable onPress={() => setInspectedEvent(null)} hitSlop={8}>
                  <AppIcon name="x" size={20} color={colors.navy[700]} />
                </Pressable>
              </View>

              {inspectedEvent && (
                <ScrollView
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Action Hero Header */}
                  <View style={styles.modalHero}>
                    <Text style={styles.modalHeroAction}>{formatAction(inspectedEvent.action)}</Text>
                    <View
                      style={[
                        styles.resultBadge,
                        getResult(inspectedEvent) === "Success"
                          ? styles.successBadge
                          : styles.failureBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.resultText,
                          getResult(inspectedEvent) === "Success"
                            ? styles.successText
                            : styles.failureText,
                        ]}
                      >
                        {getResult(inspectedEvent).toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalDescription}>{inspectedEvent.description}</Text>

                  {/* Actor Attribution Card */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionHeader}>ACTOR ATTRIBUTION</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>User Email:</Text>
                      <Text style={styles.detailVal}>{inspectedEvent.actorEmail}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Assigned Role:</Text>
                      <Text style={styles.detailVal}>{formatRole(inspectedEvent.actorRole)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Actor ID:</Text>
                      <Text style={styles.detailValMonospace}>{inspectedEvent.actorId}</Text>
                    </View>
                  </View>

                  {/* Target Attribution Card */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionHeader}>TARGET RESOURCE</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Target Resource ID:</Text>
                      <Text style={styles.detailValMonospace}>{inspectedEvent.targetId}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Target Email / Ref:</Text>
                      <Text style={styles.detailVal}>{inspectedEvent.targetEmail}</Text>
                    </View>
                  </View>

                  {/* Origin Client & Device */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionHeader}>ORIGIN & CLIENT METADATA</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>IP Address:</Text>
                      <Text style={styles.detailValMonospace}>
                        {inspectedEvent.ipAddress || "Not captured"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>User Agent / App:</Text>
                      <Text style={styles.detailVal} numberOfLines={2}>
                        {inspectedEvent.userAgent || "JusticeNow Client"}
                      </Text>
                    </View>
                  </View>

                  {/* Sanitized JSON Payload (AC 5 / JN-285) */}
                  <View style={styles.detailSection}>
                    <View style={styles.jsonHeaderRow}>
                      <Text style={styles.detailSectionHeader}>EVENT DETAILS (CREDENTIALS REDACTED)</Text>
                      <View style={styles.sanitizedBadge}>
                        <AppIcon name="shield-check" size={11} color={colors.success} />
                        <Text style={styles.sanitizedBadgeText}>Zero Credential Leakage</Text>
                      </View>
                    </View>

                    <View style={styles.jsonContainer}>
                      <Text style={styles.jsonText}>
                        {JSON.stringify(inspectedEvent.details, null, 2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalCloseRow}>
                    <Pressable
                      style={styles.modalCloseBtn}
                      onPress={() => setInspectedEvent(null)}
                    >
                      <Text style={styles.modalCloseBtnText}>Close Inspection</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[50],
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: colors.navy[800],
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 1,
    color: colors.textSecondary,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.68,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 32,
    gap: 12,
  },
  unauthorizedNotice: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
  },
  unauthorizedTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.error,
  },
  unauthorizedText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[800],
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy[800],
  },
  kpiLabel: {
    marginTop: 2,
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  searchContainer: {
    height: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.navy[800],
  } as any,
  categorySection: {
    gap: 6,
  },
  filterSectionTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  categoryChips: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeCategoryChip: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },
  categoryChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[700],
  },
  activeCategoryChipText: {
    color: colors.textInverse,
  },
  resultFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedTab: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[50],
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[600],
  },
  selectedTabText: {
    color: colors.royal[700],
  },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.royal[700],
  },
  auditList: {
    gap: 9,
  },
  auditCard: {
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: colors.navy[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.76,
    borderColor: colors.royal[500],
  },
  eventCategoryBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  auditDetails: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  actionTitle: {
    color: colors.navy[800],
    fontSize: 13.5,
    fontWeight: "700",
  },
  eventDescription: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  attributionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  actorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.navy[50],
  },
  actorText: {
    fontSize: 10.5,
    color: colors.navy[700],
    fontWeight: "600",
  },
  targetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.royal[50],
  },
  targetText: {
    fontSize: 10.5,
    color: colors.royal[700],
    fontWeight: "700",
    fontFamily: "monospace",
  },
  cardRightChevron: {
    alignSelf: "center",
    paddingLeft: 4,
  },
  resultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
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
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  successDot: {
    backgroundColor: colors.success,
  },
  failureDot: {
    backgroundColor: colors.error,
  },
  resultText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  successText: {
    color: colors.success,
  },
  failureText: {
    color: colors.error,
  },
  paginationContainer: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  paginationSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  paginationSummary: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pageSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pageSizeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  pageSizeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activePageSizeBtn: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },
  pageSizeBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.navy[700],
  },
  activePageSizeBtnText: {
    color: colors.textInverse,
  },
  paginationNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabledNavBtn: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  disabledNavBtnText: {
    color: colors.textSoft,
  },
  pageNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
  },
  immutabilityNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.navy[50],
  },
  retentionText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  messageContainer: {
    minHeight: 140,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  messageText: {
    color: colors.navy[800],
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  subMessageText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,27,46,0.65)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 580,
    maxHeight: "92%",
    borderRadius: 18,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.navy[50],
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy[800],
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  modalHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalHeroAction: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy[800],
  },
  modalDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.navy[700],
  },
  detailSection: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 6,
  },
  detailSectionHeader: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  detailKey: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  detailVal: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[800],
    flexShrink: 1,
    textAlign: "right",
  },
  detailValMonospace: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
    color: colors.royal[700],
    flexShrink: 1,
    textAlign: "right",
  },
  jsonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sanitizedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#EAF6F0",
  },
  sanitizedBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: colors.success,
  },
  jsonContainer: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.navy[900],
  },
  jsonText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#A7F3D0",
  },
  modalCloseRow: {
    marginTop: 6,
  },
  modalCloseBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.royal[700],
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
