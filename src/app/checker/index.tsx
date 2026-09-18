import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

import { RoleGuard } from "../../auth";
import { fetchEvidenceCheckerQueue } from "../../checker/api";
import { formatBytes, validateEvidenceMetadata } from "../../checker/metadataValidation";
import {
  CheckerFilterTab,
  CheckerSummaryStats,
  EvidenceRecord,
  EvidenceValidationStatus,
} from "../../checker/types";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { supabase } from "../../lib/supabase";
import { colors, iconSizes } from "../../theme";
import { shadows } from "../../theme/shadows";

function getPreviewBadge(kind: ReturnType<typeof validateEvidenceMetadata>["previewKind"]) {
  const map: Record<string, { icon: AppIconName; label: string }> = {
    image: { icon: "image", label: "Image Preview" },
    document: { icon: "file-text", label: "Doc Reader" },
    audio: { icon: "mic", label: "Audio Player" },
    video: { icon: "video", label: "Video Player" },
    unsupported: { icon: "warning", label: "Controlled DL" },
  };

  return map[kind] ?? { icon: "document", label: "Preview" };
}

export default function EvidenceCheckerDashboard() {
  const router = useRouter();

  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CheckerFilterTab>("pending");
  const [, setIsAuthorized] = useState<boolean | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
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
  }, []);

  const loadData = useCallback(async () => {
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
  }, [checkAuth]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const validatedRecords = useMemo(
    () =>
      records.map((record) => ({
        record,
        validation: validateEvidenceMetadata(record),
      })),
    [records],
  );

  const stats: CheckerSummaryStats = useMemo(() => {
    let pendingCount = 0;
    let underReviewCount = 0;
    let validatedCount = 0;
    let rejectedCount = 0;
    let archivedCount = 0;
    let invalidMetadataCount = 0;
    let storageInsecureCount = 0;

    validatedRecords.forEach(({ record, validation }) => {
      if (!validation.isValid) invalidMetadataCount++;
      if (!validation.isStorageSecure) storageInsecureCount++;

      if (record.validationStatus === "pending") pendingCount++;
      else if (record.validationStatus === "under_review") underReviewCount++;
      else if (record.validationStatus === "validated") validatedCount++;
      else if (record.validationStatus === "rejected") rejectedCount++;
      else if (record.validationStatus === "archived") archivedCount++;
    });

    return {
      totalCount: records.length,
      pendingCount,
      underReviewCount,
      validatedCount,
      rejectedCount,
      archivedCount,
      invalidMetadataCount,
      storageInsecureCount,
    };
  }, [records, validatedRecords]);

  const filteredList = useMemo(() => {
    const list = validatedRecords.filter(({ record, validation }) => {
      if (activeTab === "pending" && record.validationStatus !== "pending") return false;
      if (activeTab === "under_review" && record.validationStatus !== "under_review") return false;
      if (
        activeTab === "completed" &&
        record.validationStatus !== "validated" &&
        record.validationStatus !== "approved" &&
        record.validationStatus !== "rejected"
      )
        return false;
      if (activeTab === "validated" && record.validationStatus !== "validated" && record.validationStatus !== "approved")
        return false;
      if (activeTab === "rejected" && record.validationStatus !== "rejected") return false;
      if (activeTab === "archived" && record.validationStatus !== "archived") return false;
      if (activeTab === "invalid_metadata" && validation.isValid) return false;
      if (activeTab === "storage_insecure" && validation.isStorageSecure) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      return (
        record.id.toLowerCase().includes(q) ||
        (record.caseInfo?.caseReference || record.caseId).toLowerCase().includes(q) ||
        (record.reporterInfo?.fullName || record.reporterId).toLowerCase().includes(q) ||
        record.fileName.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.record.assignedAt || a.record.uploadDate).getTime();
      const timeB = new Date(b.record.assignedAt || b.record.uploadDate).getTime();
      return timeB - timeA;
    });
  }, [validatedRecords, activeTab, searchQuery]);

  const completedCount = stats.validatedCount + stats.rejectedCount;

  return (
    <RoleGuard allowedRoles={["evidence_validator"]}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.navy[900]} />

        <View style={styles.header}>
          <View style={styles.headerInner}>
            <View style={styles.headerTop}>
              <View>
                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>Role: Evidence Validator</Text>
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
                <AppIcon name="test-tube" size={14} color={colors.surface} />
                <Text style={styles.simulatorButtonText}>Test Criteria</Text>
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <AppIcon name="search" size={14} color={colors.navy[300]} />
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

        <View style={styles.statsBar}>
          <View style={styles.statsBarInner}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalCount}</Text>
              <Text style={styles.statLabel}>Total Evidence</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.royal[700] }]}>{stats.pendingCount}</Text>
              <Text style={styles.statLabel}>Pending Queue</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.teal[700] }]}>{stats.validatedCount}</Text>
              <Text style={styles.statLabel}>Validated</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: "#DC2626" }]}>{stats.storageInsecureCount}</Text>
              <Text style={styles.statLabel}>Storage Risk</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <View style={styles.tabsRowInner}>
            <TabButton
              label={`Pending Queue (${stats.pendingCount})`}
              active={activeTab === "pending"}
              onPress={() => setActiveTab("pending")}
            />
            <TabButton
              label={`Completed (${completedCount})`}
              active={activeTab === "completed"}
              onPress={() => setActiveTab("completed")}
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <AppIcon name="list-checks" size={40} color={colors.navy[300]} />
                <Text style={styles.emptyTitle}>No evidence records found</Text>
                <Text style={styles.emptySub}>Try adjusting your search criteria or status filter.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const { record, validation } = item;
              const ext = record.fileName.split(".").pop()?.toUpperCase() || "FILE";
              const formattedUploadDate = new Date(record.uploadDate).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const assignedDateSource = record.assignedAt || record.uploadDate;
              const formattedAssignedDate = new Date(assignedDateSource).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const isMissingFile = record.fileExistsInStorage === false;
              const preview = getPreviewBadge(validation.previewKind);
              const isCompleted =
                record.validationStatus === "validated" ||
                record.validationStatus === "approved" ||
                record.validationStatus === "rejected" ||
                record.validationStatus === "archived";

              return (
                <Pressable
                  style={[styles.evidenceCard, isCompleted && styles.completedEvidenceCard]}
                  onPress={() =>
                    router.push({
                      pathname: "/checker/evidence/[id]",
                      params: { id: record.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Review evidence ${record.id}`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.idContainer}>
                      <AppIcon name="id-card" size={11} color={colors.navy[700]} />
                      <Text style={styles.idText}>{record.id}</Text>
                    </View>
                    <View style={styles.badgeRowHeader}>
                      {isCompleted ? (
                        <View style={styles.completedTagBadge}>
                          <AppIcon name="check" size={10} color="#065F46" />
                          <Text style={styles.completedTagText}>Completed Item</Text>
                        </View>
                      ) : null}
                      <StatusBadge status={record.validationStatus} />
                    </View>
                  </View>

                  <View style={styles.fileRow}>
                    <View style={[styles.fileTypeBadge, isCompleted && styles.completedFileTypeBadge]}>
                      <Text style={[styles.fileTypeBadgeText, isCompleted && styles.completedFileTypeBadgeText]}>{ext}</Text>
                    </View>

                    <View style={styles.fileMainInfo}>
                      <Text style={styles.fileNameText} numberOfLines={1}>
                        {record.fileName}
                      </Text>

                      <View style={styles.previewTagRow}>
                        <Text style={styles.fileMetaText}>
                          Type: {record.evidenceType} ({record.fileType}) · {formatBytes(record.fileSizeBytes)}
                        </Text>

                        <View style={styles.previewBadge}>
                          <AppIcon name={preview.icon} size={10} color={colors.royal[700]} />
                          <Text style={styles.previewBadgeText}>{preview.label}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.linkContainer, isCompleted && styles.completedLinkContainer]}>
                    <View style={styles.linkRow}>
                      <AppIcon name="folder-open" size={11} color={colors.navy[600]} />
                      <Text style={styles.linkLabel}>Case Reference:</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {record.caseInfo?.caseReference || record.caseId || "UNLINKED"}
                        {record.caseInfo?.title ? ` - ${record.caseInfo.title}` : ""}
                      </Text>
                    </View>

                    <View style={styles.linkRow}>
                      <AppIcon name="calendar" size={11} color={colors.navy[600]} />
                      <Text style={styles.linkLabel}>Assignment Date:</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {formattedAssignedDate}
                      </Text>
                    </View>

                    <View style={styles.linkRow}>
                      <AppIcon name="user" size={11} color={colors.navy[600]} />
                      <Text style={styles.linkLabel}>Reporter:</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {record.reporterInfo?.fullName || record.reporterId || "UNLINKED"}
                      </Text>
                    </View>

                    <View style={styles.linkRow}>
                      <AppIcon name="clock" size={11} color={colors.navy[600]} />
                      <Text style={styles.linkLabel}>Submitted:</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {formattedUploadDate}
                      </Text>
                    </View>
                  </View>

                  {isMissingFile ? (
                    <View style={styles.missingFileWarning}>
                      <AppIcon
                        name="warning"
                        size={iconSizes.xs}
                        color={colors.errorStrong}
                      />
                      <Text style={styles.missingFileText}>
                        Storage Object Missing / Deleted (HTTP 404 Error Handled)
                      </Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.validationBanner,
                      validation.isValid ? styles.validBanner : styles.invalidBanner,
                    ]}
                  >
                    <AppIcon
                      name={validation.isValid ? "check" : "warning"}
                      size={12}
                      color={validation.isValid ? "#047857" : "#B91C1C"}
                    />
                    <Text
                      style={[
                        styles.bannerText,
                        validation.isValid ? styles.validBannerText : styles.invalidBannerText,
                      ]}
                    >
                      {validation.isValid
                        ? "All Metadata Criteria Satisfied"
                        : `${validation.errors.length} Criteria Issue(s) Detected`}
                    </Text>
                    <AppIcon name="chevron-right" size={16} color={colors.textSecondary} />
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </RoleGuard>
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

  if (status === "under_review") {
    bg = "#E0F2FE";
    fg = "#0369A1";
    label = "Under Review";
  } else if (status === "validated") {
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
  } else if (status === "archived") {
    bg = "#F1F5F9";
    fg = "#475569";
    label = "Archived";
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusBadgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.navy[900], paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  headerInner: { maxWidth: 640, width: "100%", alignSelf: "center" },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  badgeRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  roleBadge: { backgroundColor: colors.teal[700], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 },
  roleBadgeText: { color: colors.surface, fontSize: 10.5, fontWeight: "700" },
  sdgTag: { color: colors.navy[300], fontSize: 10.5 },
  headerTitle: { color: colors.surface, fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: colors.navy[200], fontSize: 11.5, marginTop: 2 },
  simulatorButton: { backgroundColor: colors.royal[600], paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  simulatorButtonText: { color: colors.surface, fontSize: 11.5, fontWeight: "700" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.navy[800], borderRadius: 10, paddingHorizontal: 12, marginTop: 14, minHeight: 40, gap: 8 },
  searchInput: { flex: 1, color: colors.surface, fontSize: 13 },
  statsBar: { flexDirection: "row", backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  statsBarInner: { flexDirection: "row", maxWidth: 640, width: "100%", alignSelf: "center" },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 17, fontWeight: "800", color: colors.navy[800] },
  statLabel: { fontSize: 10.5, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: colors.border, height: "100%" },
  tabsRow: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsRowInner: { flexDirection: "row", maxWidth: 640, width: "100%", alignSelf: "center" },
  tabButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 6, backgroundColor: colors.navy[50] },
  tabButtonActive: { backgroundColor: colors.royal[700] },
  tabButtonErrorActive: { backgroundColor: colors.error },
  tabText: { fontSize: 11.5, fontWeight: "600", color: colors.navy[700] },
  tabTextActive: { color: colors.surface },
  tabTextErrorActive: { color: colors.surface },
  listContent: { padding: 14, paddingBottom: 32, maxWidth: 640, width: "100%", alignSelf: "center" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13, color: colors.textSecondary },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.navy[800], marginTop: 12 },
  emptySub: { fontSize: 12.5, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  evidenceCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, boxShadow: shadows.elevated, elevation: 1 },
  completedEvidenceCard: { backgroundColor: "#F9FAFB", borderColor: "#D1D5DB" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  idContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.navy[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 },
  idText: { fontSize: 12, fontWeight: "700", color: colors.navy[800] },
  badgeRowHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  completedTagBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  completedTagText: { fontSize: 10, fontWeight: "700", color: "#065F46" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  fileRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  fileTypeBadge: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.royal[50], alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1, borderColor: colors.royal[100] },
  fileTypeBadgeText: { fontSize: 10, fontWeight: "800", color: colors.royal[700] },
  completedFileTypeBadge: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  completedFileTypeBadgeText: { color: "#047857" },
  fileMainInfo: { flex: 1 },
  fileNameText: { fontSize: 14, fontWeight: "700", color: colors.navy[900] },
  fileMetaText: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  previewTagRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  previewBadge: { backgroundColor: colors.royal[50], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: colors.royal[100], flexDirection: "row", alignItems: "center", gap: 4 },
  previewBadgeText: { fontSize: 10, fontWeight: "700", color: colors.royal[700] },
  linkContainer: { backgroundColor: "#F1F5F9", padding: 8, borderRadius: 8, marginBottom: 10 },
  completedLinkContainer: { backgroundColor: "#F3F4F6" },
  linkRow: { flexDirection: "row", alignItems: "center", marginVertical: 2, gap: 5 },
  linkLabel: { fontSize: 11, fontWeight: "600", color: colors.navy[600], marginRight: 2 },
  linkValue: { fontSize: 11.5, fontWeight: "700", color: colors.navy[900], flex: 1 },
  validationBanner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, gap: 6 },
  validBanner: { backgroundColor: "#ECFDF5" },
  invalidBanner: { backgroundColor: "#FEF2F2" },
  bannerText: { fontSize: 11, fontWeight: "700", flex: 1 },
  validBannerText: { color: "#047857" },
  invalidBannerText: { color: "#B91C1C" },
  missingFileWarning: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginBottom: 10, gap: 6 },
  missingFileText: { fontSize: 11, fontWeight: "700", color: "#991B1B", flex: 1 },
});
