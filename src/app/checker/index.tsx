import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { RoleGuard } from "../../auth";
import { useAuth } from "../../auth/useAuth";
import { fetchEvidenceCheckerQueue } from "../../checker/api";
import {
  EvidenceStatusFilter,
  EvidenceTypeFilter,
  filterEvidenceRecords,
  isUserAuthorizedToFilterCheckers,
} from "../../checker/evidenceFilterService";
import { formatBytes, validateEvidenceMetadata } from "../../checker/metadataValidation";
import {
  CheckerSummaryStats,
  EvidenceRecord,
  EvidenceValidationStatus,
} from "../../checker/types";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { INITIAL_MOCK_CHECKERS } from "../../staff/checkerAvailabilityService";
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
  const auth = useAuth();

  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search state (JN-231 to JN-235)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EvidenceStatusFilter>("pending");
  const [typeFilter, setTypeFilter] = useState<EvidenceTypeFilter>("all");
  const [checkerFilter, setCheckerFilter] = useState<string>("all");
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const userRole = auth.role || "evidence_checker";
  const userId = auth.user?.id || "CHK-001-ELENA";
  const userName = auth.user?.full_name || "Elena Rostova";

  const isAuthorizedForCheckers = useMemo(
    () => isUserAuthorizedToFilterCheckers(userRole),
    [userRole]
  );

  const loadData = useCallback(async () => {
    try {
      const data = await fetchEvidenceCheckerQueue();
      setRecords(data);
    } catch (err) {
      console.error("Failed to load evidence queue:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
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
    [records]
  );

  // Calculate summary stats across overall queue
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

  // Apply multi-criteria search and filter engine (JN-231 to JN-235)
  const filterResult = useMemo(() => {
    return filterEvidenceRecords(records, {
      searchQuery,
      statusFilter,
      evidenceTypeFilter: typeFilter,
      assignedCheckerFilter: checkerFilter,
      userRole,
      userId,
      userName,
    });
  }, [records, searchQuery, statusFilter, typeFilter, checkerFilter, userRole, userId, userName]);

  const filteredRecords = filterResult.records;

  // Clear all filters action (AC 6)
  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCheckerFilter("all");
  };

  const completedCount = stats.validatedCount + stats.rejectedCount;

  return (
    <RoleGuard allowedRoles={["evidence_validator", "evidence_checker", "system_admin", "case_officer"]}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.navy[900]} />

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>Role: Evidence Checker</Text>
                  </View>
                  <Text style={styles.sdgTag}>SDG 16 · Peace & Justice</Text>
                </View>

                <Text style={styles.headerTitle}>Evidence Verification Queue</Text>
                <Text style={styles.headerSubtitle}>
                  Search & filter evidence records by case reference, status, type & checker
                </Text>
              </View>

              <Pressable
                style={styles.simulatorButton}
                onPress={() => router.push("/checker/simulator")}
                accessibilityRole="button"
                accessibilityLabel="Test criteria simulator"
              >
                <AppIcon name="test-tube" size={14} color={colors.surface} />
                <Text style={styles.simulatorButtonText}>Test Criteria</Text>
              </Pressable>
            </View>

            {/* Search Input Bar (JN-231) */}
            <View style={styles.searchRowContainer}>
              <View style={styles.searchContainer}>
                <AppIcon name="search" size={15} color={colors.navy[300]} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search case reference (e.g. JN-2026-0812), evidence ID, or file..."
                  placeholderTextColor={colors.navy[300]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                  accessibilityLabel="Search evidence by case reference or ID"
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                    <AppIcon name="x" size={14} color={colors.navy[300]} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                style={[
                  styles.filterToggleBtn,
                  filterResult.hasActiveFilters && styles.filterToggleBtnActive,
                ]}
                onPress={() => setFilterModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Open filter settings"
              >
                <AppIcon
                  name="filter"
                  size={16}
                  color={filterResult.hasActiveFilters ? colors.surface : colors.navy[200]}
                />
                {filterResult.activeFilterCount > 0 ? (
                  <View style={styles.filterBadgeCount}>
                    <Text style={styles.filterBadgeCountText}>{filterResult.activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Stats Summary Bar */}
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

        {/* Horizontal Status Filter Scroll Bar (JN-232) */}
        <View style={styles.tabsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRowInner}
          >
            <TabButton
              label={`Pending (${stats.pendingCount})`}
              active={statusFilter === "pending"}
              onPress={() => setStatusFilter("pending")}
            />
            <TabButton
              label={`Under Review (${stats.underReviewCount})`}
              active={statusFilter === "under_review"}
              onPress={() => setStatusFilter("under_review")}
            />
            <TabButton
              label={`Completed (${completedCount})`}
              active={statusFilter === "completed"}
              onPress={() => setStatusFilter("completed")}
            />
            <TabButton
              label={`All Statuses (${stats.totalCount})`}
              active={statusFilter === "all"}
              onPress={() => setStatusFilter("all")}
            />
            <TabButton
              label={`Validated (${stats.validatedCount})`}
              active={statusFilter === "validated"}
              onPress={() => setStatusFilter("validated")}
            />
            <TabButton
              label={`Rejected (${stats.rejectedCount})`}
              active={statusFilter === "rejected"}
              onPress={() => setStatusFilter("rejected")}
            />
            <TabButton
              label={`Info Requested`}
              active={statusFilter === "info_requested"}
              onPress={() => setStatusFilter("info_requested")}
            />
          </ScrollView>
        </View>

        {/* Active Filter Chips & Clear Action Banner (AC 6) */}
        {filterResult.hasActiveFilters ? (
          <View style={styles.activeFilterBanner}>
            <View style={styles.activeFilterChipsContainer}>
              {searchQuery.trim().length > 0 ? (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>Case/Query: &quot;{searchQuery}&quot;</Text>
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                    <AppIcon name="x" size={12} color={colors.royal[700]} />
                  </Pressable>
                </View>
              ) : null}

              {typeFilter !== "all" ? (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>Type: {typeFilter.toUpperCase()}</Text>
                  <Pressable onPress={() => setTypeFilter("all")} hitSlop={6}>
                    <AppIcon name="x" size={12} color={colors.royal[700]} />
                  </Pressable>
                </View>
              ) : null}

              {checkerFilter !== "all" ? (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    Checker: {checkerFilter === "unassigned" ? "Unassigned" : checkerFilter === "my_assigned" ? "Assigned to Me" : checkerFilter}
                  </Text>
                  <Pressable onPress={() => setCheckerFilter("all")} hitSlop={6}>
                    <AppIcon name="x" size={12} color={colors.royal[700]} />
                  </Pressable>
                </View>
              ) : null}

              {statusFilter !== "all" && statusFilter !== "pending" ? (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>Status: {statusFilter.replace("_", " ")}</Text>
                  <Pressable onPress={() => setStatusFilter("all")} hitSlop={6}>
                    <AppIcon name="x" size={12} color={colors.royal[700]} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <Pressable
              style={styles.clearAllBtn}
              onPress={handleClearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <AppIcon name="refresh-cw" size={12} color="#DC2626" />
              <Text style={styles.clearAllBtnText}>Clear Filters</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Results Counter Sub-header */}
        <View style={styles.resultsCountBar}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={{ fontWeight: "800", color: colors.navy[900] }}>{filteredRecords.length}</Text> of {records.length} evidence records
          </Text>
          {!isAuthorizedForCheckers ? (
            <View style={styles.restrictedAuthTag}>
              <AppIcon name="lock" size={10} color={colors.navy[600]} />
              <Text style={styles.restrictedAuthText}>Restricted View</Text>
            </View>
          ) : (
            <View style={styles.authorizedAuthTag}>
              <AppIcon name="shield-check" size={10} color={colors.teal[700]} />
              <Text style={styles.authorizedAuthText}>Authorized Filter</Text>
            </View>
          )}
        </View>

        {/* Main List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Loading evidence metadata queue...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <AppIcon name="search" size={40} color={colors.navy[300]} />
                <Text style={styles.emptyTitle}>No evidence records found</Text>
                <Text style={styles.emptySub}>
                  No items match your active case search or filter criteria.
                </Text>
                {filterResult.hasActiveFilters ? (
                  <Pressable style={styles.emptyClearBtn} onPress={handleClearFilters}>
                    <Text style={styles.emptyClearBtnText}>Reset All Filters</Text>
                  </Pressable>
                ) : null}
              </View>
            }
            renderItem={({ item: record }) => {
              const validation = validateEvidenceMetadata(record);
              const ext = record.fileName.split(".").pop()?.toUpperCase() || "FILE";
              const formattedUploadDate = new Date(record.uploadDate).toLocaleString(undefined, {
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
                  accessibilityLabel={`Review evidence ${record.id} case ${record.caseInfo?.caseReference}`}
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
                          <Text style={styles.completedTagText}>Completed</Text>
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
                      <AppIcon name="user" size={11} color={colors.navy[600]} />
                      <Text style={styles.linkLabel}>Assigned Checker:</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {record.assignedByName || record.assignedCheckerId || "Unassigned Queue"}
                      </Text>
                    </View>

                    <View style={styles.linkRow}>
                      <AppIcon name="calendar" size={11} color={colors.navy[600]} />
                      <Text style={styles.linkLabel}>Assignment Date:</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {record.assignedAt ? new Date(record.assignedAt).toLocaleDateString() : "Pending Assignment"}
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
                      <AppIcon name="warning" size={iconSizes.xs} color={colors.errorStrong} />
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

        {/* Filter Modal Dialog (JN-232, JN-233, JN-234, JN-235) */}
        <Modal
          visible={filterModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AppIcon name="filter" size={18} color={colors.navy[900]} />
                  <Text style={styles.modalTitle}>Filter Evidence Records</Text>
                </View>

                <Pressable onPress={() => setFilterModalVisible(false)} hitSlop={10}>
                  <AppIcon name="x" size={20} color={colors.navy[600]} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* 1. Evidence Status Filter (JN-232) */}
                <Text style={styles.filterSectionTitle}>1. Evidence Status</Text>
                <View style={styles.filterChipGroup}>
                  {[
                    { key: "all", label: "All Statuses" },
                    { key: "pending", label: "Pending Queue" },
                    { key: "under_review", label: "Under Review" },
                    { key: "validated", label: "Validated" },
                    { key: "rejected", label: "Rejected" },
                    { key: "info_requested", label: "Info Requested" },
                    { key: "completed", label: "Completed Items" },
                  ].map((item) => (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.modalChip,
                        statusFilter === item.key && styles.modalChipSelected,
                      ]}
                      onPress={() => setStatusFilter(item.key as EvidenceStatusFilter)}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          statusFilter === item.key && styles.modalChipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* 2. Evidence Type Filter (JN-233) */}
                <Text style={styles.filterSectionTitle}>2. Evidence File Type</Text>
                <View style={styles.filterChipGroup}>
                  {[
                    { key: "all", label: "All Types", icon: "file-text" },
                    { key: "image", label: "Photos / Images", icon: "image" },
                    { key: "video", label: "Video Feeds", icon: "video" },
                    { key: "audio", label: "Audio Recordings", icon: "mic" },
                    { key: "document", label: "PDF & Documents", icon: "file-text" },
                  ].map((item) => (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.modalChip,
                        typeFilter === item.key && styles.modalChipSelected,
                      ]}
                      onPress={() => setTypeFilter(item.key as EvidenceTypeFilter)}
                    >
                      <AppIcon
                        name={item.icon as AppIconName}
                        size={12}
                        color={typeFilter === item.key ? colors.surface : colors.navy[700]}
                      />
                      <Text
                        style={[
                          styles.modalChipText,
                          typeFilter === item.key && styles.modalChipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* 3. Assigned Checker Filter (JN-234 - Where Authorized) */}
                <Text style={styles.filterSectionTitle}>
                  3. Assigned Checker {isAuthorizedForCheckers ? "(Authorized)" : "(Restricted)"}
                </Text>
                {!isAuthorizedForCheckers ? (
                  <View style={styles.authWarningBox}>
                    <AppIcon name="lock" size={14} color={colors.navy[700]} />
                    <Text style={styles.authWarningText}>
                      Your account role restricts view to your assigned queue items. Administrative permissions required to view all squad members.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.filterChipGroup}>
                    <Pressable
                      style={[
                        styles.modalChip,
                        checkerFilter === "all" && styles.modalChipSelected,
                      ]}
                      onPress={() => setCheckerFilter("all")}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          checkerFilter === "all" && styles.modalChipTextSelected,
                        ]}
                      >
                        All Checkers
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.modalChip,
                        checkerFilter === "unassigned" && styles.modalChipSelected,
                      ]}
                      onPress={() => setCheckerFilter("unassigned")}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          checkerFilter === "unassigned" && styles.modalChipTextSelected,
                        ]}
                      >
                        Unassigned Queue
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.modalChip,
                        checkerFilter === "my_assigned" && styles.modalChipSelected,
                      ]}
                      onPress={() => setCheckerFilter("my_assigned")}
                    >
                      <Text
                        style={[
                          styles.modalChipText,
                          checkerFilter === "my_assigned" && styles.modalChipTextSelected,
                        ]}
                      >
                        Assigned to Me ({userName})
                      </Text>
                    </Pressable>

                    {INITIAL_MOCK_CHECKERS.map((checker) => (
                      <Pressable
                        key={checker.id}
                        style={[
                          styles.modalChip,
                          (checkerFilter === checker.id || checkerFilter === checker.fullName) &&
                            styles.modalChipSelected,
                        ]}
                        onPress={() => setCheckerFilter(checker.id)}
                      >
                        <Text
                          style={[
                            styles.modalChipText,
                            (checkerFilter === checker.id || checkerFilter === checker.fullName) &&
                              styles.modalChipTextSelected,
                          ]}
                        >
                          {checker.fullName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.modalResetBtn}
                  onPress={() => {
                    handleClearFilters();
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={styles.modalResetBtnText}>Reset All</Text>
                </Pressable>

                <Pressable
                  style={styles.modalApplyBtn}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={styles.modalApplyBtnText}>Apply Filters ({filteredRecords.length})</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: EvidenceValidationStatus }) {
  let bg = "#FEF3C7";
  let fg = "#92400E";
  let label = "Pending";

  if (status === "under_review") {
    bg = "#E0F2FE";
    fg = "#0369A1";
    label = "Under Review";
  } else if (status === "validated" || status === "approved") {
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
  searchRowContainer: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
  searchContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.navy[800], borderRadius: 10, paddingHorizontal: 12, minHeight: 42, gap: 8 },
  searchInput: { flex: 1, color: colors.surface, fontSize: 13 },
  clearSearchBtn: { padding: 4 },
  filterToggleBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.navy[800], alignItems: "center", justifyContent: "center", position: "relative" },
  filterToggleBtnActive: { backgroundColor: colors.royal[700] },
  filterBadgeCount: { position: "absolute", top: -4, right: -4, backgroundColor: "#DC2626", borderRadius: 10, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  filterBadgeCountText: { color: colors.surface, fontSize: 10, fontWeight: "800" },
  statsBar: { flexDirection: "row", backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  statsBarInner: { flexDirection: "row", maxWidth: 640, width: "100%", alignSelf: "center" },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 17, fontWeight: "800", color: colors.navy[800] },
  statLabel: { fontSize: 10.5, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: colors.border, height: "100%" },
  tabsRow: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsRowInner: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.navy[50] },
  tabButtonActive: { backgroundColor: colors.royal[700] },
  tabText: { fontSize: 11.5, fontWeight: "600", color: colors.navy[700] },
  tabTextActive: { color: colors.surface },
  activeFilterBanner: { backgroundColor: colors.royal[50], borderBottomWidth: 1, borderBottomColor: colors.royal[100], paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeFilterChipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1, marginRight: 8 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.royal[200], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  filterChipText: { fontSize: 11, fontWeight: "700", color: colors.royal[900] },
  clearAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#FEE2E2" },
  clearAllBtnText: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  resultsCountBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.background, maxWidth: 640, width: "100%", alignSelf: "center" },
  resultsCountText: { fontSize: 12, color: colors.textSecondary },
  restrictedAuthTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  restrictedAuthText: { fontSize: 10, fontWeight: "700", color: colors.navy[600] },
  authorizedAuthTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E6F4F1", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  authorizedAuthText: { fontSize: 10, fontWeight: "700", color: colors.teal[700] },
  listContent: { padding: 14, paddingBottom: 32, maxWidth: 640, width: "100%", alignSelf: "center" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13, color: colors.textSecondary },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.navy[800], marginTop: 12 },
  emptySub: { fontSize: 12.5, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  emptyClearBtn: { marginTop: 14, backgroundColor: colors.royal[700], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  emptyClearBtnText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", paddingBottom: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.navy[900] },
  modalBody: { padding: 18 },
  filterSectionTitle: { fontSize: 13, fontWeight: "800", color: colors.navy[900], marginTop: 10, marginBottom: 8 },
  filterChipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  modalChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.navy[50], borderWidth: 1, borderColor: colors.navy[100] },
  modalChipSelected: { backgroundColor: colors.royal[700], borderColor: colors.royal[800] },
  modalChipText: { fontSize: 12, fontWeight: "600", color: colors.navy[700] },
  modalChipTextSelected: { color: colors.surface, fontWeight: "700" },
  authWarningBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#F3F4F6", padding: 10, borderRadius: 8, marginBottom: 12 },
  authWarningText: { fontSize: 11.5, color: colors.navy[700], flex: 1 },
  modalFooter: { flexDirection: "row", paddingHorizontal: 18, paddingTop: 12, gap: 12, borderTopWidth: 1, borderTopColor: colors.border },
  modalResetBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.navy[100], alignItems: "center" },
  modalResetBtnText: { color: colors.navy[800], fontSize: 13, fontWeight: "700" },
  modalApplyBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.royal[700], alignItems: "center" },
  modalApplyBtnText: { color: colors.surface, fontSize: 13, fontWeight: "800" },
});
