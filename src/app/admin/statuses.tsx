import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth";
import { normalizeRole } from "../../auth/roles";
import { AppIcon, AppIconName, isAppIconName } from "../../components/AppIcon";
import {
  createStatusConfig,
  deleteStatusConfig,
  getStatusConfigs,
  toggleStatusActive,
  updateStatusConfig,
} from "../../status-config/statusService";
import {
  CreateStatusConfigInput,
  StatusConfigTone,
  StatusEntityType,
  StatusFilterOptions,
  WorkflowStatusConfig,
} from "../../status-config/types";
import { canDeleteStatus, slugifyStatusCode } from "../../status-config/validation";
import { colors } from "../../theme";

const AVAILABLE_TONES: { label: string; value: StatusConfigTone; color: string; bg: string }[] = [
  { label: "Information", value: "info", color: colors.royal[700], bg: "#EBF2FC" },
  { label: "Warning", value: "warning", color: colors.warning, bg: "#FDF6E7" },
  { label: "Success", value: "success", color: colors.success, bg: "#EAF6F0" },
  { label: "Danger", value: "danger", color: colors.error, bg: "#FBEEEC" },
  { label: "Neutral", value: "neutral", color: colors.navy[600], bg: colors.navy[50] },
];

export default function AdminStatusesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isAuthorized = userRole === "system_admin";

  // Entity tab state: 'case' or 'evidence'
  const [activeEntityType, setActiveEntityType] = useState<StatusEntityType>("case");
  const [statuses, setStatuses] = useState<WorkflowStatusConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter options
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<WorkflowStatusConfig | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<StatusConfigTone>("info");
  const [icon, setIcon] = useState<AppIconName>("document");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Deletion blocked / info modal state
  const [deleteBlockedModal, setDeleteBlockedModal] = useState<{
    visible: boolean;
    status: WorkflowStatusConfig | null;
    reason: string;
    activeCount: number;
  }>({
    visible: false,
    status: null,
    reason: "",
    activeCount: 0,
  });

  const loadStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const filterOpts: StatusFilterOptions = {
        searchQuery: searchQuery.trim() || undefined,
        statusFilter,
      };
      const records = await getStatusConfigs(activeEntityType, filterOpts);
      setStatuses(records);
    } catch (error) {
      console.error("Unable to load workflow status configurations:", error);
    } finally {
      setLoading(false);
    }
  }, [activeEntityType, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStatuses();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStatuses]);

  // Overall counts for current entity type
  const metrics = useMemo(() => {
    const total = statuses.length;
    const active = statuses.filter((s) => s.isActive).length;
    const inactive = statuses.filter((s) => !s.isActive).length;
    const defaults = statuses.filter((s) => s.isSystemDefault).length;
    return { total, active, inactive, defaults };
  }, [statuses]);

  const resetForm = () => {
    setEditingStatus(null);
    setName("");
    setCode("");
    setDescription("");
    setTone("info");
    setIcon(activeEntityType === "case" ? "document" : "file-search");
    setDisplayOrder(String(statuses.length + 1));
    setFormErrors([]);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (st: WorkflowStatusConfig) => {
    setEditingStatus(st);
    setName(st.name);
    setCode(st.code);
    setDescription(st.description);
    setTone(st.tone);
    setIcon((st.icon as AppIconName) || (activeEntityType === "case" ? "document" : "file-search"));
    setDisplayOrder(String(st.displayOrder));
    setFormErrors([]);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    resetForm();
  };

  // Handle name input with slug code auto-generation
  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingStatus) {
      setCode(slugifyStatusCode(val));
    }
  };

  // Create or Update status handler
  const handleSaveStatus = async () => {
    setFormErrors([]);

    const actor = {
      role: user?.role || "system_admin",
      userId: user?.id || "admin-system",
      email: user?.email || "admin@justicenow.org",
    };

    const parsedOrder = parseInt(displayOrder, 10) || 1;

    try {
      setSaving(true);

      if (editingStatus) {
        // Edit existing status
        const res = await updateStatusConfig(
          editingStatus.id,
          {
            name: name.trim(),
            description: description.trim(),
            tone,
            icon,
            displayOrder: parsedOrder,
          },
          actor,
          "Admin updated status metadata",
        );

        if (!res.success) {
          setFormErrors(res.errors || [res.error || "Could not update status configuration."]);
          return;
        }

        Alert.alert("Status Updated", `"${name.trim()}" was updated successfully.`);
      } else {
        // Create new status
        const input: CreateStatusConfigInput = {
          entityType: activeEntityType,
          code: code.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim(),
          tone,
          icon,
          isActive: true,
          displayOrder: parsedOrder,
        };

        const res = await createStatusConfig(input, actor);

        if (!res.success) {
          setFormErrors(res.errors || [res.error || "Could not create status configuration."]);
          return;
        }

        Alert.alert("Status Created", `New ${activeEntityType} status "${name.trim()}" was added.`);
      }

      setShowModal(false);
      resetForm();
      await loadStatuses();
    } catch (error: any) {
      setFormErrors([error?.message || "An unexpected error occurred while saving."]);
    } finally {
      setSaving(false);
    }
  };

  // Toggle active/inactive switch (AC 5)
  const handleToggleActive = async (st: WorkflowStatusConfig) => {
    const nextVal = !st.isActive;
    const actor = {
      role: user?.role || "system_admin",
      userId: user?.id || "admin-system",
      email: user?.email || "admin@justicenow.org",
    };

    const res = await toggleStatusActive(
      st.id,
      nextVal,
      actor,
      `Toggled status active state to ${nextVal}`,
    );

    if (!res.success) {
      Alert.alert("Update Failed", res.error || "Could not toggle status.");
      return;
    }

    setStatuses((current) =>
      current.map((item) => (item.id === st.id ? { ...item, isActive: nextVal } : item)),
    );
  };

  // Delete status check & action (AC 4)
  const handleDeleteStatus = async (st: WorkflowStatusConfig) => {
    const check = canDeleteStatus(st);

    if (!check.allowed) {
      // AC 4: Show safe blocking modal explaining why
      setDeleteBlockedModal({
        visible: true,
        status: st,
        reason: check.reason || "Status cannot be deleted unsafely.",
        activeCount: check.activeRecordCount,
      });
      return;
    }

    // Confirm deletion for unused custom status
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to permanently delete custom status "${st.name}" (${st.code})? This action will be audited.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Status",
          style: "destructive",
          onPress: async () => {
            const actor = {
              role: user?.role || "system_admin",
              userId: user?.id || "admin-system",
              email: user?.email || "admin@justicenow.org",
            };
            const res = await deleteStatusConfig(st.id, actor, "Admin removed unused status");
            if (!res.success) {
              Alert.alert("Deletion Failed", res.error || "Could not delete status.");
              return;
            }
            Alert.alert("Status Deleted", `Status "${st.name}" was successfully removed.`);
            await loadStatuses();
          },
        },
      ],
    );
  };

  const getToneStyle = (t: StatusConfigTone) => {
    const found = AVAILABLE_TONES.find((item) => item.value === t);
    return found || AVAILABLE_TONES[0];
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <AppIcon name="arrow-left" size={20} color={colors.navy[700]} />
        </Pressable>

        <View style={styles.headerIcon}>
          <AppIcon name="shield-check" size={20} color={colors.royal[700]} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Workflow Status Configuration</Text>
          <Text style={styles.headerSubtitle}>
            Controlled case and evidence status values (JN-273 - JN-278)
          </Text>
        </View>

        {isAuthorized && (
          <Pressable
            style={styles.addButton}
            onPress={openCreateModal}
            accessibilityRole="button"
            accessibilityLabel="Add new status"
          >
            <AppIcon name="plus" size={16} color={colors.textInverse} />
            <Text style={styles.addButtonText}>Add Status</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Authorization Alert Banner (AC 6) */}
        {!isAuthorized && (
          <View style={styles.unauthorizedNotice}>
            <AppIcon name="shield-alert" size={20} color={colors.error} />
            <View style={styles.unauthorizedContent}>
              <Text style={styles.unauthorizedTitle}>Restricted Access (AC 6)</Text>
              <Text style={styles.unauthorizedText}>
                Only authorized System Administrators can configure case and evidence status
                values. Read-only view enabled.
              </Text>
            </View>
          </View>
        )}

        {/* Entity Type Tab Selector (JN-273: Case vs Evidence) */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tabButton, activeEntityType === "case" && styles.activeTabButton]}
            onPress={() => setActiveEntityType("case")}
          >
            <AppIcon
              name="document"
              size={17}
              color={activeEntityType === "case" ? colors.textInverse : colors.navy[600]}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeEntityType === "case" && styles.activeTabButtonText,
              ]}
            >
              Case Statuses
            </Text>
            <View
              style={[
                styles.tabCountBadge,
                activeEntityType === "case" && styles.activeTabCountBadge,
              ]}
            >
              <Text
                style={[
                  styles.tabCountText,
                  activeEntityType === "case" && styles.activeTabCountText,
                ]}
              >
                {activeEntityType === "case" ? statuses.length : "8"}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.tabButton, activeEntityType === "evidence" && styles.activeTabButton]}
            onPress={() => setActiveEntityType("evidence")}
          >
            <AppIcon
              name="file-search"
              size={17}
              color={activeEntityType === "evidence" ? colors.textInverse : colors.navy[600]}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeEntityType === "evidence" && styles.activeTabButtonText,
              ]}
            >
              Evidence Statuses
            </Text>
            <View
              style={[
                styles.tabCountBadge,
                activeEntityType === "evidence" && styles.activeTabCountBadge,
              ]}
            >
              <Text
                style={[
                  styles.tabCountText,
                  activeEntityType === "evidence" && styles.activeTabCountText,
                ]}
              >
                {activeEntityType === "evidence" ? statuses.length : "6"}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.total}</Text>
            <Text style={styles.metricLabel}>Total Configured</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.success }]}>{metrics.active}</Text>
            <Text style={styles.metricLabel}>Active in Workflows</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.textSecondary }]}>
              {metrics.inactive}
            </Text>
            <Text style={styles.metricLabel}>Hidden / Inactive</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.royal[700] }]}>
              {metrics.defaults}
            </Text>
            <Text style={styles.metricLabel}>System Defaults</Text>
          </View>
        </View>

        {/* Search and Status Filters */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <AppIcon name="search" size={17} color={colors.textSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${activeEntityType} statuses...`}
              placeholderTextColor={colors.textSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <AppIcon name="x" size={16} color={colors.textSoft} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterTabs}>
            <Pressable
              style={[styles.filterPill, statusFilter === "all" && styles.activeFilterPill]}
              onPress={() => setStatusFilter("all")}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === "all" && styles.activeFilterPillText,
                ]}
              >
                All Statuses
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterPill, statusFilter === "active" && styles.activeFilterPill]}
              onPress={() => setStatusFilter("active")}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === "active" && styles.activeFilterPillText,
                ]}
              >
                Active Only (AC 5)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterPill, statusFilter === "inactive" && styles.activeFilterPill]}
              onPress={() => setStatusFilter("inactive")}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === "inactive" && styles.activeFilterPillText,
                ]}
              >
                Inactive (Hidden)
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Status Configurations Card List */}
        <View style={styles.configurationCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupHeaderText}>
              {activeEntityType.toUpperCase()} WORKFLOW TERMINOLOGY & CONTROLS
            </Text>
            <Text style={styles.groupHeaderSub}>
              Order dictates transition presentation in Case Management and Evidence Review
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.royal[700]} />
              <Text style={styles.loadingText}>Loading status definitions...</Text>
            </View>
          ) : statuses.length === 0 ? (
            <View style={styles.emptyState}>
              <AppIcon name="file-search" size={36} color={colors.navy[300]} />
              <Text style={styles.emptyTitle}>No matching statuses found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search criteria or add a new status configuration.
              </Text>
            </View>
          ) : (
            <View style={styles.statusList}>
              {statuses.map((st, index) => {
                const toneStyle = getToneStyle(st.tone);
                const hasActiveRecords = st.activeRecordCount > 0;

                return (
                  <View
                    key={st.id}
                    style={[
                      styles.statusRow,
                      index === statuses.length - 1 && styles.lastStatusRow,
                      !st.isActive && styles.inactiveStatusRow,
                    ]}
                  >
                    {/* Left Icon with Tone Color */}
                    <View style={[styles.statusIconContainer, { backgroundColor: toneStyle.bg }]}>
                      <AppIcon
                        name={
                          isAppIconName(st.icon ?? "")
                            ? ((st.icon ?? "document") as AppIconName)
                            : "document"
                        }
                        size={20}
                        color={toneStyle.color}
                      />
                    </View>

                    {/* Middle: Details */}
                    <View style={styles.statusDetails}>
                      <View style={styles.statusTitleRow}>
                        <Text style={styles.statusName}>{st.name}</Text>

                        {/* Tone Badge */}
                        <View style={[styles.toneBadge, { backgroundColor: toneStyle.bg }]}>
                          <Text style={[styles.toneBadgeText, { color: toneStyle.color }]}>
                            {st.tone.toUpperCase()}
                          </Text>
                        </View>

                        {/* System Default vs Custom Badge */}
                        {st.isSystemDefault ? (
                          <View style={styles.systemBadge}>
                            <Text style={styles.systemBadgeText}>DEFAULT</Text>
                          </View>
                        ) : (
                          <View style={styles.customBadge}>
                            <Text style={styles.customBadgeText}>CUSTOM</Text>
                          </View>
                        )}
                      </View>

                      {/* Code & Display Order */}
                      <View style={styles.codeRow}>
                        <Text style={styles.statusCode}>code: {st.code}</Text>
                        <Text style={styles.orderBadge}>Order #{st.displayOrder}</Text>
                      </View>

                      {/* Description */}
                      <Text style={styles.statusDescription} numberOfLines={3}>
                        {st.description}
                      </Text>

                      {/* Record Usage Info (AC 4) */}
                      <View style={styles.usageRow}>
                        <AppIcon
                          name={hasActiveRecords ? "activity" : "shield-check"}
                          size={13}
                          color={hasActiveRecords ? colors.navy[600] : colors.textSoft}
                        />
                        <Text
                          style={[
                            styles.usageText,
                            hasActiveRecords && styles.usageTextActive,
                          ]}
                        >
                          {st.activeRecordCount > 0
                            ? `${st.activeRecordCount} active ${activeEntityType} records using this status`
                            : "0 active records (safe to modify)"}
                        </Text>
                      </View>

                      {/* Action buttons */}
                      {isAuthorized && (
                        <View style={styles.cardActionRow}>
                          <Pressable
                            style={styles.cardActionButton}
                            onPress={() => openEditModal(st)}
                          >
                            <AppIcon name="edit" size={14} color={colors.royal[700]} />
                            <Text style={styles.cardActionText}>Edit</Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.cardActionButton,
                              styles.cardDeleteButton,
                            ]}
                            onPress={() => void handleDeleteStatus(st)}
                          >
                            <AppIcon name="trash" size={14} color={colors.error} />
                            <Text style={[styles.cardActionText, { color: colors.error }]}>
                              Delete
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>

                    {/* Right: Active Toggle (AC 5) */}
                    {isAuthorized && (
                      <View style={styles.toggleContainer}>
                        <Text
                          style={[
                            styles.toggleLabel,
                            { color: st.isActive ? colors.success : colors.textSoft },
                          ]}
                        >
                          {st.isActive ? "Active" : "Hidden"}
                        </Text>
                        <Switch
                          value={st.isActive}
                          onValueChange={() => void handleToggleActive(st)}
                          trackColor={{
                            false: colors.border,
                            true: colors.teal[200],
                          }}
                          thumbColor={st.isActive ? colors.teal[600] : colors.textSoft}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Informative Governance Alert */}
        <View style={styles.governanceNotice}>
          <AppIcon name="balance" size={20} color={colors.royal[700]} />
          <View style={styles.governanceContent}>
            <Text style={styles.governanceTitle}>Workflow Integrity Policy</Text>
            <Text style={styles.governanceText}>
              • Active statuses are automatically presented to Case Officers and Evidence Checkers
              in workflow dropdowns.{"\n"}
              • Inactive statuses are hidden from new operations while preserving full audit and
              historical case logs (AC 5).{"\n"}
              • Statuses with active record dependencies are protected against unsafe deletion (AC 4).
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Create / Edit Modal (AC 3: Duplicate checking, tone assignment) */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingStatus
                    ? `Edit ${editingStatus.name}`
                    : `Add New ${activeEntityType === "case" ? "Case" : "Evidence"} Status`}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingStatus
                    ? `Update workflow settings for [code: ${editingStatus.code}]`
                    : `Define a consistent status code and UI presentation`}
                </Text>
              </View>

              <Pressable onPress={closeModal} disabled={saving}>
                <AppIcon name="x" size={20} color={colors.navy[700]} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Validation Errors Box */}
              {formErrors.length > 0 && (
                <View style={styles.errorNotice}>
                  <AppIcon name="alert-circle" size={18} color={colors.error} />
                  <View style={{ flex: 1 }}>
                    {formErrors.map((err, i) => (
                      <Text key={i} style={styles.errorText}>
                        • {err}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Status Name */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Display Name *</Text>
                <TextInput
                  value={name}
                  onChangeText={handleNameChange}
                  style={styles.input}
                  placeholder="e.g. Legal Escalation, Forensic Verified"
                  placeholderTextColor={colors.textSoft}
                />
              </View>

              {/* Status Code (Unique slug) */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  Status Code * {editingStatus && "(Code is immutable for data integrity)"}
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  editable={!editingStatus}
                  style={[styles.input, editingStatus && styles.disabledInput]}
                  placeholder="e.g. legal_escalation"
                  placeholderTextColor={colors.textSoft}
                  autoCapitalize="none"
                />
                <Text style={styles.fieldHint}>
                  Unique lowercase identifier used by backend API and workflow state machines.
                </Text>
              </View>

              {/* Tone Selection */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Visual Tone / Badge Color</Text>
                <View style={styles.toneGrid}>
                  {AVAILABLE_TONES.map((t) => (
                    <Pressable
                      key={t.value}
                      style={[
                        styles.toneOption,
                        { backgroundColor: t.bg, borderColor: tone === t.value ? t.color : "transparent" },
                        tone === t.value && styles.selectedToneOption,
                      ]}
                      onPress={() => setTone(t.value)}
                    >
                      <View style={[styles.toneDot, { backgroundColor: t.color }]} />
                      <Text style={[styles.toneOptionText, { color: t.color }]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description *</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  style={styles.textArea}
                  placeholder="Explain when this workflow status is reached and what actions it triggers..."
                  placeholderTextColor={colors.textSoft}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Display Order & Icon */}
              <View style={styles.rowFields}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Display Order</Text>
                  <TextInput
                    value={displayOrder}
                    onChangeText={setDisplayOrder}
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={colors.textSoft}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Icon Glyph</Text>
                  <TextInput
                    value={icon}
                    onChangeText={(val) => setIcon(isAppIconName(val) ? (val as AppIconName) : "document")}
                    style={styles.input}
                    placeholder="document, clock, shield-check"
                    placeholderTextColor={colors.textSoft}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Modal Action Buttons */}
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeModal}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.createButton}
                  onPress={() => void handleSaveStatus()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <>
                      <AppIcon
                        name={editingStatus ? "check" : "plus"}
                        size={16}
                        color={colors.textInverse}
                      />
                      <Text style={styles.createButtonText}>
                        {editingStatus ? "Update Status" : "Create Status"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* AC 4: Deletion Protection Explanatory Modal */}
      <Modal
        visible={deleteBlockedModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDeleteBlockedModal({ visible: false, status: null, reason: "", activeCount: 0 })
        }
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxWidth: 500 }]}>
            <View style={[styles.modalHeader, { backgroundColor: "#FBEEEC" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AppIcon name="shield-alert" size={22} color={colors.error} />
                <Text style={[styles.modalTitle, { color: colors.error }]}>
                  Deletion Protected (AC 4)
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  setDeleteBlockedModal({
                    visible: false,
                    status: null,
                    reason: "",
                    activeCount: 0,
                  })
                }
              >
                <AppIcon name="x" size={20} color={colors.navy[700]} />
              </Pressable>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.protectionNoticeBox}>
                <Text style={styles.protectionNoticeText}>
                  {deleteBlockedModal.reason}
                </Text>
              </View>

              <Text style={styles.protectionExplanation}>
                To preserve historical integrity and avoid data corruption in active investigations,
                statuses in active use cannot be deleted.
                {"\n\n"}
                <Text style={{ fontWeight: "700" }}>Recommended Action:</Text> Deactivate this
                status instead. Deactivating will hide it from all new cases and evidence submissions
                (AC 5) while keeping existing records safely intact.
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() =>
                    setDeleteBlockedModal({
                      visible: false,
                      status: null,
                      reason: "",
                      activeCount: 0,
                    })
                  }
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </Pressable>

                {deleteBlockedModal.status && deleteBlockedModal.status.isActive && (
                  <Pressable
                    style={[styles.createButton, { backgroundColor: colors.warning }]}
                    onPress={async () => {
                      const st = deleteBlockedModal.status;
                      if (!st) return;
                      setDeleteBlockedModal({
                        visible: false,
                        status: null,
                        reason: "",
                        activeCount: 0,
                      });
                      await handleToggleActive(st);
                    }}
                  >
                    <AppIcon name="eye-off" size={16} color={colors.textInverse} />
                    <Text style={styles.createButtonText}>Deactivate Instead</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[50],
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  addButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.royal[700],
  },
  addButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  unauthorizedNotice: {
    padding: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
  },
  unauthorizedContent: {
    flex: 1,
  },
  unauthorizedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },
  unauthorizedText: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.navy[700],
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.navy[100],
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 9,
  },
  activeTabButton: {
    backgroundColor: colors.navy[800],
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },
  activeTabButtonText: {
    color: colors.textInverse,
  },
  tabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.navy[200],
  },
  activeTabCountBadge: {
    backgroundColor: colors.royal[700],
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.navy[800],
  },
  activeTabCountText: {
    color: colors.textInverse,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.navy[800],
  },
  metricLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    color: colors.textSecondary,
  },
  filterSection: {
    gap: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.navy[800],
  } as any,
  filterTabs: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeFilterPill: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[700],
  },
  activeFilterPillText: {
    color: colors.textInverse,
  },
  configurationCard: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  groupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.navy[50],
  },
  groupHeaderText: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.navy[800],
  },
  groupHeaderSub: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },
  loadingState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    color: colors.textSecondary,
  },
  statusList: {
    paddingHorizontal: 14,
  },
  statusRow: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastStatusRow: {
    borderBottomWidth: 0,
  },
  inactiveStatusRow: {
    opacity: 0.72,
    backgroundColor: "#F9FAFB",
  },
  statusIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  statusDetails: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  statusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  statusName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  toneBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  toneBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  systemBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: colors.navy[100],
  },
  systemBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.navy[600],
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "#EAF6F0",
  },
  customBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.success,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusCode: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
    color: colors.royal[700],
  },
  orderBadge: {
    fontSize: 10.5,
    color: colors.textSoft,
  },
  statusDescription: {
    fontSize: 12,
    lineHeight: 16.5,
    color: colors.textSecondary,
  },
  usageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  usageText: {
    fontSize: 11,
    color: colors.textSoft,
  },
  usageTextActive: {
    fontWeight: "600",
    color: colors.navy[700],
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  cardActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.royal[50],
  },
  cardDeleteButton: {
    backgroundColor: "#FBEEEC",
  },
  cardActionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  toggleContainer: {
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  governanceNotice: {
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.royal[200],
    backgroundColor: colors.royal[50],
  },
  governanceContent: {
    flex: 1,
  },
  governanceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.royal[800],
  },
  governanceText: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.navy[800],
  },
  modalOverlay: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,27,46,0.65)",
  },
  modal: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  errorNotice: {
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
    flexDirection: "row",
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.error,
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
  },
  fieldHint: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    fontSize: 13,
    color: colors.navy[800],
  } as any,
  disabledInput: {
    backgroundColor: colors.navy[50],
    color: colors.textSecondary,
  },
  textArea: {
    minHeight: 80,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    fontSize: 13,
    color: colors.navy[800],
  } as any,
  toneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toneOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 2,
  },
  selectedToneOption: {
    shadowColor: colors.navy[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  toneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toneOptionText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  rowFields: {
    flexDirection: "row",
    gap: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },
  createButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.royal[700],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
  protectionNoticeBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FBEEEC",
    borderWidth: 1,
    borderColor: "#F6DAD6",
  },
  protectionNoticeText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.error,
    lineHeight: 17,
  },
  protectionExplanation: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.navy[800],
  },
});
