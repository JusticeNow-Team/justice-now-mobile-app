import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleGuard, useAuth } from "../../auth";
import { colors } from "../../theme";

export default function EvidenceCheckerScreen() {
  const router = useRouter();
  const { user, role, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <RoleGuard allowedRoles={["evidence_checker"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Evidence Checker</Text>
            <Text style={styles.headerSubtitle}>Forensic Validation Portal</Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={styles.signOutButton}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>🔍 Evidence Checker</Text>
            </View>
            <Text style={styles.userName}>
              {user?.full_name || "Evidence Validator"}
            </Text>
            <Text style={styles.userRole}>
              Active Role: <Text style={styles.bold}>{role}</Text>
            </Text>
          </View>

          {/* Quick Metrics */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Pending Review</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>48</Text>
              <Text style={styles.statLabel}>Validated</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Flagged</Text>
            </View>
          </View>

          {/* Permissions Overview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Granted System Capabilities</Text>
            <View style={styles.permissionItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.permissionText}>
                Validate & verify evidence authenticity (
                <Text style={styles.codeText}>evidence:validate</Text>)
              </Text>
            </View>
            <View style={styles.permissionItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.permissionText}>
                Read all evidence files & metadata (
                <Text style={styles.codeText}>evidence:read:all</Text>)
              </Text>
            </View>
            <View style={styles.permissionItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.permissionText}>
                View assigned case details (
                <Text style={styles.codeText}>cases:read:assigned</Text>)
              </Text>
            </View>
          </View>

          {/* Action notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>🛡️ Chain of Custody Protected</Text>
            <Text style={styles.noticeText}>
              All forensic checks, hash validations, and verification decisions
              are immutably logged with timestamp and officer ID.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </RoleGuard>
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { fetchEvidenceCheckerQueue } from "../../checker/api";
import { formatBytes, validateEvidenceMetadata } from "../../checker/metadataValidation";
import {
  CheckerFilterTab,
  CheckerSummaryStats,
  EvidenceRecord,
  EvidenceValidationStatus,
} from "../../checker/types";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

export default function EvidenceCheckerDashboard() {
  const router = useRouter();

  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CheckerFilterTab>("pending");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const checkAuth = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        // Allow demo mode access for local testing, but record auth status
        setIsAuthorized(true);
        return true;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionData.session.user.id)
        .single();

      if (profile && profile.role !== "evidence_validator" && profile.role !== "system_admin") {
        setIsAuthorized(false);
        return false;
      }

      setIsAuthorized(true);
      return true;
    } catch {
      setIsAuthorized(true);
      return true;
    }
  };

  const loadData = async () => {
    try {
      await checkAuth();
      const data = await fetchEvidenceCheckerQueue();
      setRecords(data);
    } catch (err) {
      console.error("Failed to load evidence queue:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Compute validation results for all items
  const validatedRecords = useMemo(() => {
    return records.map((record) => {
      const validation = validateEvidenceMetadata(record);
      return {
        record,
        validation,
      };
    });
  }, [records]);

  // Compute summary stats
  const stats: CheckerSummaryStats = useMemo(() => {
    let pendingCount = 0;
    let validatedCount = 0;
    let rejectedCount = 0;
    let invalidMetadataCount = 0;
    let storageInsecureCount = 0;

    validatedRecords.forEach(({ record, validation }) => {
      if (!validation.isValid) {
        invalidMetadataCount++;
      }
      if (!validation.isStorageSecure) {
        storageInsecureCount++;
      }
      if (record.validationStatus === "pending") {
        pendingCount++;
      } else if (record.validationStatus === "validated") {
        validatedCount++;
      } else if (record.validationStatus === "rejected") {
        rejectedCount++;
      }
    });

    return {
      totalCount: records.length,
      pendingCount,
      validatedCount,
      rejectedCount,
      invalidMetadataCount,
      storageInsecureCount,
    };
  }, [validatedRecords, records]);

  // Filter list by tab and search, sorted strictly by submission date descending (newest first)
  const filteredList = useMemo(() => {
    const list = validatedRecords.filter(({ record, validation }) => {
      // Tab filter
      if (activeTab === "pending" && record.validationStatus !== "pending") return false;
      if (activeTab === "validated" && record.validationStatus !== "validated") return false;
      if (activeTab === "rejected" && record.validationStatus !== "rejected") return false;
      if (activeTab === "invalid_metadata" && validation.isValid) return false;
      if (activeTab === "storage_insecure" && validation.isStorageSecure) return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const matchId = record.id.toLowerCase().includes(q);
      const matchCase = (record.caseInfo?.caseReference || record.caseId).toLowerCase().includes(q);
      const matchReporter = (record.reporterInfo?.fullName || record.reporterId).toLowerCase().includes(q);
      const matchFileName = record.fileName.toLowerCase().includes(q);

      return matchId || matchCase || matchReporter || matchFileName;
    });

    return list.sort(
      (a, b) => new Date(b.record.uploadDate).getTime() - new Date(a.record.uploadDate).getTime()
    );
  }, [validatedRecords, activeTab, searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy[900]} />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.badgeRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>Role: Evidence Checker</Text>
                </View>
                <Text style={styles.sdgTag}>SDG 16 · Peace & Justice</Text>
              </View>

              <Text style={styles.headerTitle}>Evidence Metadata Audit</Text>
              <Text style={styles.headerSubtitle}>
                Verification & safe evidence preview before legal case submission
              </Text>
            </View>

            <Pressable
              style={styles.simulatorButton}
              onPress={() => router.push("/checker/simulator")}
            >
              <Text style={styles.simulatorButtonText}>🧪 Test Criteria</Text>
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search evidence ID, file name, or case reference..."
              placeholderTextColor={colors.navy[300]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </View>

      {/* Summary Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statsBarInner}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCount}</Text>
            <Text style={styles.statLabel}>Total Evidence</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.royal[700] }]}>
              {stats.pendingCount}
            </Text>
            <Text style={styles.statLabel}>Pending Queue</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.teal[700] }]}>
              {stats.validatedCount}
            </Text>
            <Text style={styles.statLabel}>Validated</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#DC2626" }]}>
              {stats.storageInsecureCount}
            </Text>
            <Text style={styles.statLabel}>Storage Risk</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <View style={styles.tabsRowInner}>
          <TabButton
            label={`Pending Queue (${stats.pendingCount})`}
            active={activeTab === "pending"}
            onPress={() => setActiveTab("pending")}
          />
          <TabButton
            label={`All (${stats.totalCount})`}
            active={activeTab === "all"}
            onPress={() => setActiveTab("all")}
          />
          <TabButton
            label={`Validated (${stats.validatedCount})`}
            active={activeTab === "validated"}
            onPress={() => setActiveTab("validated")}
          />
          <TabButton
            label={`Insecure (${stats.storageInsecureCount})`}
            active={activeTab === "storage_insecure"}
            onPress={() => setActiveTab("storage_insecure")}
            isErrorTab
          />
          <TabButton
            label={`Errors (${stats.invalidMetadataCount})`}
            active={activeTab === "invalid_metadata"}
            onPress={() => setActiveTab("invalid_metadata")}
            isErrorTab
          />
        </View>
      </View>

      {/* Main Evidence Queue List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.royal[700]} />
          <Text style={styles.loadingText}>Loading evidence metadata queue...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.record.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No evidence records found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search criteria or status filter.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const { record, validation } = item;
            const ext = record.fileName.split(".").pop()?.toUpperCase() || "FILE";
            const formattedDate = new Date(record.uploadDate).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
            const isMissingFile = record.fileExistsInStorage === false;
            const previewKind = validation.previewKind;

            return (
              <Pressable
                style={styles.evidenceCard}
                onPress={() =>
                  router.push({
                    pathname: "/checker/evidence/[id]",
                    params: { id: record.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Review evidence ${record.id}`}
              >
                {/* Header line: Unique ID & Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.idContainer}>
                    <Text style={styles.idIcon}>🆔</Text>
                    <Text style={styles.idText}>{record.id}</Text>
                  </View>

                  <StatusBadge status={record.validationStatus} />
                </View>

                {/* File Title & Icon */}
                <View style={styles.fileRow}>
                  <View style={styles.fileTypeBadge}>
                    <Text style={styles.fileTypeBadgeText}>{ext}</Text>
                  </View>

                  <View style={styles.fileMainInfo}>
                    <Text style={styles.fileNameText} numberOfLines={1}>
                      {record.fileName}
                    </Text>

                    <View style={styles.previewTagRow}>
                      <Text style={styles.fileMetaText}>
                        {record.fileType} · {formatBytes(record.fileSizeBytes)}
                      </Text>

                      {/* Safe Preview Capability Badge */}
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>
                          {previewKind === "image" && "🖼️ Image Preview"}
                          {previewKind === "document" && "📄 Doc Reader"}
                          {previewKind === "audio" && "🎵 Audio Player"}
                          {previewKind === "video" && "🎥 Video Player"}
                          {previewKind === "unsupported" && "⚠️ Controlled DL"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Case, Reporter & Submission Date Link Metadata */}
                <View style={styles.linkContainer}>
                  <View style={styles.linkRow}>
                    <Text style={styles.linkIcon}>📁</Text>
                    <Text style={styles.linkLabel}>Case Link:</Text>
                    <Text style={styles.linkValue} numberOfLines={1}>
                      {record.caseInfo?.caseReference || record.caseId || "❌ UNLINKED"}
                      {record.caseInfo?.title ? ` - ${record.caseInfo.title}` : ""}
                    </Text>
                  </View>

                  <View style={styles.linkRow}>
                    <Text style={styles.linkIcon}>👤</Text>
                    <Text style={styles.linkLabel}>Reporter:</Text>
                    <Text style={styles.linkValue} numberOfLines={1}>
                      {record.reporterInfo?.fullName || record.reporterId || "❌ UNLINKED"}
                    </Text>
                  </View>

                  <View style={styles.linkRow}>
                    <Text style={styles.linkIcon}>📅</Text>
                    <Text style={styles.linkLabel}>Submitted:</Text>
                    <Text style={styles.linkValue} numberOfLines={1}>
                      {formattedDate}
                    </Text>
                  </View>
                </View>

                {/* Safely Handle Missing or Deleted Storage File */}
                {isMissingFile && (
                  <View style={styles.missingFileWarning}>
                    <Text style={styles.missingFileIcon}>⚠️</Text>
                    <Text style={styles.missingFileText}>
                      Storage Object Missing / Deleted (HTTP 404 Error Handled)
                    </Text>
                  </View>
                )}

                {/* Validation Health Audit Banner */}
                <View
                  style={[
                    styles.validationBanner,
                    validation.isValid
                      ? styles.validBanner
                      : styles.invalidBanner,
                  ]}
                >
                  <Text style={styles.bannerIcon}>
                    {validation.isValid ? "✓" : "⚠️"}
                  </Text>

                  <Text
                    style={[
                      styles.bannerText,
                      validation.isValid
                        ? styles.validBannerText
                        : styles.invalidBannerText,
                    ]}
                  >
                    {validation.isValid
                      ? "All Metadata Criteria Satisfied"
                      : `${validation.errors.length} Criteria Issue(s) Detected`}
                  </Text>

                  <Text style={styles.chevron}>›</Text>
                </View>
              </Pressable>
            );
          }}

        />
      )}
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
  isErrorTab,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  isErrorTab?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.tabButton,
        active && styles.tabButtonActive,
        active && isErrorTab && styles.tabButtonErrorActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.tabText,
          active && styles.tabTextActive,
          active && isErrorTab && styles.tabTextErrorActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: EvidenceValidationStatus }) {
  let bg = "#FEF3C7";
  let fg = "#92400E";
  let label = "Pending (#8)";

  if (status === "validated") {
    bg = "#D1FAE5";
    fg = "#065F46";
    label = "Validated";
  } else if (status === "rejected") {
    bg = "#FEE2E2";
    fg = "#991B1B";
    label = "Rejected";
  } else if (status === "info_requested") {
    bg = "#E0E7FF";
    fg = "#3730A3";
    label = "Info Requested";
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusBadgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  signOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },
  content: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EAF7F8",
    borderWidth: 1,
    borderColor: "#A2E0E4",
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#155C63",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },
  userRole: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: "600",
    color: colors.navy[800],
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy[900],
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.success,
  },
  permissionText: {
    fontSize: 13,
    color: colors.navy[800],
    flex: 1,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: colors.royal[700],
  },
  noticeCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EAF7F8",
    borderWidth: 1,
    borderColor: "#CFEFF1",
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#17737B",
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    backgroundColor: "#F8FAFC",
  },

  header: {
    backgroundColor: colors.navy[900],
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },

  headerInner: {
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  roleBadge: {
    backgroundColor: colors.teal[700],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },

  roleBadgeText: {
    color: colors.surface,
    fontSize: 10.5,
    fontWeight: "700",
  },

  sdgTag: {
    color: colors.navy[300],
    fontSize: 10.5,
  },

  headerTitle: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: colors.navy[200],
    fontSize: 11.5,
    marginTop: 2,
  },

  simulatorButton: {
    backgroundColor: colors.royal[600],
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },

  simulatorButtonText: {
    color: colors.surface,
    fontSize: 11.5,
    fontWeight: "700",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.navy[800],
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    minHeight: 40,
  },

  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: colors.surface,
    fontSize: 13,
  },

  // Stats bar
  statsBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  statsBarInner: {
    flexDirection: "row",
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },

  statCard: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy[800],
  },

  statLabel: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },

  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    height: "100%",
  },

  // Filter tabs
  tabsRow: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tabsRowInner: {
    flexDirection: "row",
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },

  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    backgroundColor: colors.navy[50],
  },

  tabButtonActive: {
    backgroundColor: colors.royal[700],
  },

  tabButtonErrorActive: {
    backgroundColor: colors.error,
  },

  tabText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
  },

  tabTextActive: {
    color: colors.surface,
  },

  tabTextErrorActive: {
    color: colors.surface,
  },

  // List content
  listContent: {
    padding: 14,
    paddingBottom: 32,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },

  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },

  emptySub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },

  // Evidence card
  evidenceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  idContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.navy[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  idIcon: {
    fontSize: 11,
    marginRight: 4,
  },

  idText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  fileTypeBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.royal[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.royal[100],
  },

  fileTypeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.royal[700],
  },

  fileMainInfo: {
    flex: 1,
  },

  fileNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
  },

  fileMetaText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },

  previewTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },

  previewBadge: {
    backgroundColor: colors.royal[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.royal[100],
  },

  previewBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.royal[700],
  },


  linkContainer: {
    backgroundColor: "#F1F5F9",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },

  linkIcon: {
    fontSize: 11,
    marginRight: 5,
  },

  linkLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[600],
    marginRight: 6,
  },

  linkValue: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[900],
    flex: 1,
  },

  // Validation banner
  validationBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },

  validBanner: {
    backgroundColor: "#ECFDF5",
  },

  invalidBanner: {
    backgroundColor: "#FEF2F2",
  },

  bannerIcon: {
    fontSize: 12,
    marginRight: 6,
  },

  bannerText: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },

  validBannerText: {
    color: "#047857",
  },

  invalidBannerText: {
    color: "#B91C1C",
  },

  chevron: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: "700",
  },

  missingFileWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },

  missingFileIcon: {
    fontSize: 12,
    marginRight: 6,
  },

  missingFileText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#991B1B",
    flex: 1,
  },
});
