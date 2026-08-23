import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleGuard, useAuth } from "../../auth";
import {
  canDeactivateStaff,
  checkDuplicateStaffEmail,
  createStaffAccount,
  getStaffAccounts,
  getStaffAuditLogs,
  StaffAccount,
  StaffAuditLog,
  StaffRole,
  toggleStaffActive,
  validateStaffInput,
} from "../../staff";
import { colors } from "../../theme";

type FilterTab = "all" | "case_officer" | "evidence_checker" | "system_admin" | "inactive";

export default function AdminStaffScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Create Staff Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("case_officer");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Audit Logs Modal State
  const [auditModalVisible, setAuditModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [staffData, auditData] = await Promise.all([
        getStaffAccounts(),
        getStaffAuditLogs(),
      ]);
      setStaffList(staffData);
      setAuditLogs(auditData);
    } catch (err) {
      console.error("Failed to load staff data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Filtered staff records
  const filteredStaff = useMemo(() => {
    let list = [...staffList];

    if (activeTab === "inactive") {
      list = list.filter((s) => !s.isActive);
    } else if (activeTab !== "all") {
      list = list.filter((s) => s.role === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.department && s.department.toLowerCase().includes(q))
      );
    }

    return list;
  }, [staffList, activeTab, searchQuery]);

  // Statistics
  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.isActive).length;
  const inactiveCount = staffList.filter((s) => !s.isActive).length;

  // Toggle Activation/Deactivation with Confirmation (AC 3 & 6)
  const handleToggleActive = (staff: StaffAccount) => {
    const nextState = !staff.isActive;
    const actionWord = nextState ? "activate" : "deactivate";

    const guard = canDeactivateStaff(staff, user?.id);
    if (!nextState && !guard.allowed) {
      Alert.alert("Action Blocked", guard.reason || "You cannot deactivate this account.");
      return;
    }

    const executeToggle = async () => {
      try {
        const result = await toggleStaffActive(
          staff.id,
          nextState,
          user?.email || "admin@justicenow.org",
          nextState ? "Admin activation" : "Admin deactivation"
        );

        if (!result.success) {
          Alert.alert("Update Failed", result.error || "Could not update status.");
          return;
        }

        setStaffList((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, isActive: nextState, status: nextState ? "active" : "inactive" } : s))
        );

        // Refresh audit log
        const updatedLogs = await getStaffAuditLogs();
        setAuditLogs(updatedLogs);

        Alert.alert(
          "Staff Status Updated",
          `Account for ${staff.fullName} is now ${nextState ? "Active" : "Deactivated"}.`
        );
      } catch (err: any) {
        Alert.alert("Error", err.message || "Unable to update account status.");
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Are you sure you want to ${actionWord} the account for ${staff.fullName} (${staff.email})?`
      );
      if (confirmed) {
        void executeToggle();
      }
    } else {
      Alert.alert(
        `Confirm ${nextState ? "Activation" : "Deactivation"}`,
        `Are you sure you want to ${actionWord} ${staff.fullName}? ${
          !nextState ? "They will be blocked from logging in immediately." : "They will be able to access their assigned dashboard."
        }`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: nextState ? "Activate" : "Deactivate",
            style: nextState ? "default" : "destructive",
            onPress: executeToggle,
          },
        ]
      );
    }
  };

  // Create Staff Form Submission (AC 2, 4, 6, 7)
  const handleCreateStaff = async () => {
    setModalError("");

    const input = {
      fullName,
      email,
      role,
      department,
      phone,
      password: password || undefined,
      isActive: true,
    };

    const validation = validateStaffInput(input);
    if (!validation.isValid) {
      setModalError(validation.errors.join(" "));
      return;
    }

    const dupCheck = checkDuplicateStaffEmail(email, staffList);
    if (dupCheck.isDuplicate) {
      setModalError(dupCheck.error || "Duplicate email address.");
      return;
    }

    try {
      setModalSubmitting(true);
      const result = await createStaffAccount(input, user?.email || "admin@justicenow.org");

      if (!result.success || !result.staff) {
        setModalError(result.error || "Failed to create staff account.");
        return;
      }

      setStaffList((prev) => [result.staff!, ...prev]);

      // Refresh audit logs
      const updatedLogs = await getStaffAuditLogs();
      setAuditLogs(updatedLogs);

      // Reset form
      setFullName("");
      setEmail("");
      setDepartment("");
      setPhone("");
      setPassword("");
      setCreateModalVisible(false);

      Alert.alert(
        "Staff Account Created",
        `Successfully added ${result.staff.fullName} as ${getRoleLabel(result.staff.role)}.`
      );
    } catch (err: any) {
      setModalError(err.message || "Failed to create staff account.");
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Staff Accounts</Text>
              <Text style={styles.headerSubtitle}>
                Manage Case Officers & Evidence Checkers
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.auditButton}
              onPress={() => setAuditModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="View Staff Audit Trail"
            >
              <Text style={styles.auditButtonText}>📜 Audit Trail</Text>
            </Pressable>

            <Pressable
              style={styles.addButton}
              onPress={() => setCreateModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Create Staff Account"
            >
              <Text style={styles.addButtonText}>+ Invite Staff</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Live Metrics Summary Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>{totalCount}</Text>
              <Text style={styles.metricLabel}>Total Staff</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, styles.activeColor]}>
                {activeCount}
              </Text>
              <Text style={styles.metricLabel}>Active</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, styles.inactiveColor]}>
                {inactiveCount}
              </Text>
              <Text style={styles.metricLabel}>Deactivated</Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, email, or department..."
              placeholderTextColor={colors.textSoft}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Text style={styles.clearSearch}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            <Pressable
              style={[styles.tabButton, activeTab === "all" && styles.tabActive]}
              onPress={() => setActiveTab("all")}
            >
              <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
                All Staff ({totalCount})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === "case_officer" && styles.tabActive]}
              onPress={() => setActiveTab("case_officer")}
            >
              <Text style={[styles.tabText, activeTab === "case_officer" && styles.tabTextActive]}>
                ⚖️ Officers ({staffList.filter((s) => s.role === "case_officer").length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === "evidence_checker" && styles.tabActive]}
              onPress={() => setActiveTab("evidence_checker")}
            >
              <Text style={[styles.tabText, activeTab === "evidence_checker" && styles.tabTextActive]}>
                🔍 Checkers ({staffList.filter((s) => s.role === "evidence_checker").length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === "system_admin" && styles.tabActive]}
              onPress={() => setActiveTab("system_admin")}
            >
              <Text style={[styles.tabText, activeTab === "system_admin" && styles.tabTextActive]}>
                ⚙️ Admins ({staffList.filter((s) => s.role === "system_admin").length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === "inactive" && styles.tabActive]}
              onPress={() => setActiveTab("inactive")}
            >
              <Text style={[styles.tabText, activeTab === "inactive" && styles.tabTextActive]}>
                🚫 Deactivated ({inactiveCount})
              </Text>
            </Pressable>
          </ScrollView>

          {/* Staff List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.royal[700]} />
              <Text style={styles.loadingText}>Loading staff accounts...</Text>
            </View>
          ) : filteredStaff.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>No Staff Accounts Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "No staff match your search criteria."
                  : "Tap '+ Invite Staff' to add authorized team members."}
              </Text>
            </View>
          ) : (
            <View style={styles.staffGrid}>
              {filteredStaff.map((staff) => (
                <View
                  key={staff.id}
                  style={[
                    styles.staffCard,
                    !staff.isActive && styles.staffCardInactive,
                  ]}
                >
                  <View style={styles.staffCardHeader}>
                    <View style={styles.staffAvatar}>
                      <Text style={styles.avatarIcon}>
                        {getRoleIcon(staff.role)}
                      </Text>
                    </View>

                    <View style={styles.staffMainInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.staffName}>{staff.fullName}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            staff.isActive
                              ? styles.statusActiveBadge
                              : styles.statusInactiveBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              staff.isActive
                                ? styles.statusActiveText
                                : styles.statusInactiveText,
                            ]}
                          >
                            {staff.isActive ? "● Active" : "○ Deactivated"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.staffEmail}>{staff.email}</Text>
                      {staff.department && (
                        <Text style={styles.staffDept}>🏢 {staff.department}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.staffCardFooter}>
                    <Pressable
                      style={styles.roleChip}
                      onPress={() => router.push("/admin/roles")}
                      accessibilityRole="button"
                      accessibilityLabel="Manage role in Roles & Permissions"
                    >
                      <Text style={styles.roleChipText}>
                        {getRoleLabel(staff.role)} ✏️
                      </Text>
                    </Pressable>

                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>
                        {staff.isActive ? "Active Access" : "Blocked"}
                      </Text>
                      <Switch
                        value={staff.isActive}
                        onValueChange={() => handleToggleActive(staff)}
                        trackColor={{ false: "#D1D5DB", true: colors.royal[600] }}
                        thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ================================================================= */}
        {/* CREATE STAFF MODAL (JN-194 & JN-196) */}
        {/* ================================================================= */}
        <Modal
          visible={createModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>+ Invite Staff Account</Text>
                <Pressable
                  onPress={() => setCreateModalVisible(false)}
                  style={styles.closeModalBtn}
                >
                  <Text style={styles.closeModalText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalForm}
              >
                {/* Full Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      setModalError("");
                    }}
                    placeholder="e.g. Investigator Dilshan Perera"
                    placeholderTextColor={colors.textSoft}
                    style={styles.formInput}
                  />
                </View>

                {/* Email */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Staff Email Address *</Text>
                  <TextInput
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      setModalError("");
                    }}
                    placeholder="staff.name@justicenow.org"
                    placeholderTextColor={colors.textSoft}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.formInput}
                  />
                </View>

                {/* Role Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Authorized Staff Role *</Text>
                  <View style={styles.rolePickerGrid}>
                    <Pressable
                      style={[
                        styles.rolePickBtn,
                        role === "case_officer" && styles.rolePickActive,
                      ]}
                      onPress={() => setRole("case_officer")}
                    >
                      <Text style={styles.rolePickIcon}>⚖️</Text>
                      <Text
                        style={[
                          styles.rolePickText,
                          role === "case_officer" && styles.rolePickTextActive,
                        ]}
                      >
                        Case Officer
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.rolePickBtn,
                        role === "evidence_checker" && styles.rolePickActive,
                      ]}
                      onPress={() => setRole("evidence_checker")}
                    >
                      <Text style={styles.rolePickIcon}>🔍</Text>
                      <Text
                        style={[
                          styles.rolePickText,
                          role === "evidence_checker" && styles.rolePickTextActive,
                        ]}
                      >
                        Evidence Checker
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.rolePickBtn,
                        role === "system_admin" && styles.rolePickActive,
                      ]}
                      onPress={() => setRole("system_admin")}
                    >
                      <Text style={styles.rolePickIcon}>⚙️</Text>
                      <Text
                        style={[
                          styles.rolePickText,
                          role === "system_admin" && styles.rolePickTextActive,
                        ]}
                      >
                        System Admin
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Department */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Department / Bureau</Text>
                  <TextInput
                    value={department}
                    onChangeText={setDepartment}
                    placeholder="e.g. Civil Rights Investigation Unit"
                    placeholderTextColor={colors.textSoft}
                    style={styles.formInput}
                  />
                </View>

                {/* Phone */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Contact Phone</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. +94 77 123 4567"
                    placeholderTextColor={colors.textSoft}
                    keyboardType="phone-pad"
                    style={styles.formInput}
                  />
                </View>

                {/* Initial Password */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Initial Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min 6 characters (or send auto-invite)"
                    placeholderTextColor={colors.textSoft}
                    secureTextEntry
                    style={styles.formInput}
                  />
                </View>

                {/* Modal Error */}
                {modalError !== "" && (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorText}>{modalError}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.modalActionRow}>
                  <Pressable
                    style={styles.modalCancelBtn}
                    onPress={() => setCreateModalVisible(false)}
                    disabled={modalSubmitting}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalSubmitBtn,
                      modalSubmitting && styles.btnDisabled,
                    ]}
                    onPress={handleCreateStaff}
                    disabled={modalSubmitting}
                  >
                    {modalSubmitting ? (
                      <ActivityIndicator color={colors.textInverse} />
                    ) : (
                      <Text style={styles.modalSubmitText}>Create Account</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ================================================================= */}
        {/* VIEW AUDIT LOGS MODAL (JN-197) */}
        {/* ================================================================= */}
        <Modal
          visible={auditModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAuditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, styles.auditModalCard]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📜 Staff Administrative Audit Trail</Text>
                <Pressable
                  onPress={() => setAuditModalVisible(false)}
                  style={styles.closeModalBtn}
                >
                  <Text style={styles.closeModalText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.auditList}
              >
                {auditLogs.length === 0 ? (
                  <Text style={styles.emptyAuditText}>No audit events recorded yet.</Text>
                ) : (
                  auditLogs.map((log) => (
                    <View key={log.id} style={styles.auditItem}>
                      <View style={styles.auditItemHeader}>
                        <View style={styles.auditTypeBadge}>
                          <Text style={styles.auditTypeBadgeText}>
                            {formatAuditEvent(log.eventType)}
                          </Text>
                        </View>
                        <Text style={styles.auditTime}>
                          {new Date(log.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.auditDesc}>{log.description}</Text>
                      <Text style={styles.auditActor}>
                        Actor: <Text style={styles.bold}>{log.actorEmail}</Text> ➔ Target:{" "}
                        <Text style={styles.bold}>{log.targetStaffEmail}</Text>
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

function getRoleLabel(role: StaffRole): string {
  switch (role) {
    case "case_officer":
      return "Case Officer";
    case "evidence_checker":
      return "Evidence Checker";
    case "system_admin":
      return "System Admin";
    default:
      return role;
  }
}

function getRoleIcon(role: StaffRole): string {
  switch (role) {
    case "case_officer":
      return "⚖️";
    case "evidence_checker":
      return "🔍";
    case "system_admin":
      return "⚙️";
    default:
      return "👤";
  }
}

function formatAuditEvent(type: string): string {
  switch (type) {
    case "STAFF_ACCOUNT_CREATED":
      return "ACCOUNT CREATED";
    case "STAFF_ACCOUNT_ACTIVATED":
      return "ACTIVATED";
    case "STAFF_ACCOUNT_DEACTIVATED":
      return "DEACTIVATED";
    case "STAFF_ROLE_CHANGED":
      return "ROLE CHANGED";
    default:
      return type;
  }
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 28,
    color: colors.navy[700],
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  auditButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[200],
  },
  auditButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  addButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  metricsBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy[900],
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activeColor: {
    color: colors.success,
  },
  inactiveColor: {
    color: colors.error,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.navy[900],
  },
  clearSearch: {
    fontSize: 14,
    color: colors.textSoft,
    paddingHorizontal: 4,
  },
  tabsContainer: {
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  staffGrid: {
    gap: 12,
  },
  staffCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  staffCardInactive: {
    opacity: 0.75,
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  staffCardHeader: {
    flexDirection: "row",
    gap: 12,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.royal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIcon: {
    fontSize: 22,
  },
  staffMainInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  staffName: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.navy[900],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusActiveBadge: {
    backgroundColor: "#E6F4EA",
  },
  statusInactiveBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  statusActiveText: {
    color: "#137333",
  },
  statusInactiveText: {
    color: "#B91C1C",
  },
  staffEmail: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  staffDept: {
    fontSize: 11.5,
    color: colors.textSoft,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  staffCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[800],
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 27, 46, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  auditModalCard: {
    maxWidth: 560,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalForm: {
    gap: 12,
  },
  formGroup: {
    gap: 5,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  formInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: colors.navy[900],
    backgroundColor: colors.surface,
  },
  rolePickerGrid: {
    flexDirection: "row",
    gap: 6,
  },
  rolePickBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.navy[50],
  },
  rolePickActive: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },
  rolePickIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  rolePickText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.navy[700],
    textAlign: "center",
  },
  rolePickTextActive: {
    color: colors.royal[800],
    fontWeight: "700",
  },
  modalErrorBox: {
    padding: 10,
    backgroundColor: "#FFF2F1",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.error,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  modalSubmitBtn: {
    flex: 2,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.royal[700],
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  auditList: {
    gap: 10,
  },
  emptyAuditText: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 13,
    paddingVertical: 20,
  },
  auditItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
    gap: 4,
  },
  auditItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  auditTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.royal[100],
  },
  auditTypeBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: colors.royal[900],
  },
  auditTime: {
    fontSize: 10.5,
    color: colors.textSoft,
  },
  auditDesc: {
    fontSize: 12,
    color: colors.navy[900],
  },
  auditActor: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: "700",
  },
});
