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
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAllRoles,
  getPermissionDiff,
  PermissionDiff,
  RoleGuard,
  SystemRole,
  updateUserRole,
  useAuth,
} from "../../auth";
import { getStaffAccounts, StaffAccount } from "../../staff";
import { colors } from "../../theme";

type ViewMode = "definitions" | "assignment";

export default function AdminRolesManagementScreen() {
  const router = useRouter();
  const { user, role: myRole } = useAuth();
  const roles = getAllRoles();

  const [viewMode, setViewMode] = useState<ViewMode>("definitions");
  const [selectedRole, setSelectedRole] = useState<SystemRole>("system_admin");

  // Assignment Tab State
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Role Change Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [targetStaff, setTargetStaff] = useState<StaffAccount | null>(null);
  const [proposedRole, setProposedRole] = useState<SystemRole>("case_officer");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const currentRoleDef = roles.find((r) => r.id === selectedRole) || roles[0];

  const loadStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const data = await getStaffAccounts();
      setStaffList(data);
    } catch (err) {
      console.error("Failed to load staff for role assignment:", err);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "assignment") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadStaff();
    }
  }, [viewMode, loadStaff]);

  // Permission difference preview (JN-241 & JN-242)
  const permissionDiff: PermissionDiff | null = useMemo(() => {
    if (!targetStaff) return null;
    return getPermissionDiff(targetStaff.role, proposedRole);
  }, [targetStaff, proposedRole]);

  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffList;
    const q = searchQuery.trim().toLowerCase();
    return staffList.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.department && s.department.toLowerCase().includes(q))
    );
  }, [staffList, searchQuery]);

  const openRoleChangeModal = (staff: StaffAccount) => {
    setTargetStaff(staff);
    setProposedRole(staff.role === "case_officer" ? "evidence_checker" : "case_officer");
    setReason("");
    setModalError("");
    setModalVisible(true);
  };

  const handleApplyRoleChange = async () => {
    if (!targetStaff) return;
    setModalError("");

    const performUpdate = async () => {
      try {
        setSubmitting(true);
        const result = await updateUserRole({
          actorRole: myRole,
          actorUserId: user?.id,
          actorUserEmail: user?.email || "admin@justicenow.org",
          targetUserId: targetStaff.id,
          targetUserEmail: targetStaff.email,
          targetCurrentRole: targetStaff.role,
          newRole: proposedRole,
          reason: reason.trim() || undefined,
        });

        if (!result.success || !result.newRole) {
          setModalError(result.error || "Failed to update role.");
          return;
        }

        // Update local state
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === targetStaff.id ? { ...s, role: result.newRole! } : s
          )
        );

        setModalVisible(false);

        Alert.alert(
          "Role Updated Successfully",
          `${targetStaff.fullName}'s role has been changed to "${result.newRole}". Permissions have been updated.`
        );
      } catch (err: any) {
        setModalError(err.message || "Failed to update role.");
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Are you sure you want to change ${targetStaff.fullName}'s role from ${targetStaff.role} to ${proposedRole}?`
      );
      if (confirmed) {
        void performUpdate();
      }
    } else {
      Alert.alert(
        "Confirm Role Change",
        `Change role for ${targetStaff.fullName} from ${targetStaff.role} to ${proposedRole}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Update Role",
            style: proposedRole === "system_admin" ? "destructive" : "default",
            onPress: performUpdate,
          },
        ]
      );
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
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Roles & Permissions</Text>
              <Text style={styles.headerSubtitle}>
                RBAC Configuration & User Role Assignment
              </Text>
            </View>
          </View>
        </View>

        {/* View Mode Switcher */}
        <View style={styles.modeSwitchRow}>
          <Pressable
            style={[
              styles.modeBtn,
              viewMode === "definitions" && styles.modeBtnActive,
            ]}
            onPress={() => setViewMode("definitions")}
          >
            <Text
              style={[
                styles.modeBtnText,
                viewMode === "definitions" && styles.modeBtnTextActive,
              ]}
            >
              🔐 Role Definitions
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modeBtn,
              viewMode === "assignment" && styles.modeBtnActive,
            ]}
            onPress={() => setViewMode("assignment")}
          >
            <Text
              style={[
                styles.modeBtnText,
                viewMode === "assignment" && styles.modeBtnTextActive,
              ]}
            >
              👥 Assign Roles ({staffList.length})
            </Text>
          </Pressable>
        </View>

        {viewMode === "definitions" ? (
          /* ================================================================= */
          /* 1. ROLE DEFINITIONS & PERMISSIONS MATRIX */
          /* ================================================================= */
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Role selector tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContainer}
            >
              {roles.map((r) => {
                const active = r.id === selectedRole;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedRole(r.id)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={styles.tabIcon}>{r.icon}</Text>
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                    >
                      {r.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Active Role Card */}
            <View style={styles.card}>
              <View style={styles.roleHeader}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: currentRoleDef.badgeColor.background },
                  ]}
                >
                  <Text style={styles.roleIconLarge}>{currentRoleDef.icon}</Text>
                </View>
                <View style={styles.roleTitleWrap}>
                  <Text style={styles.roleTitle}>{currentRoleDef.label}</Text>
                  <Text style={styles.roleSub}>
                    Role Key: <Text style={styles.codeText}>{currentRoleDef.id}</Text>
                  </Text>
                </View>
              </View>

              <Text style={styles.roleDesc}>{currentRoleDef.description}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>DEFAULT WORKSPACE</Text>
                  <Text style={styles.metaValue}>{currentRoleDef.defaultRoute}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>ACCOUNT TYPE</Text>
                  <Text style={styles.metaValue}>
                    {currentRoleDef.isStaff ? "JusticeNow Staff" : "Public Reporter"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Permissions Matrix */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Assigned Permissions ({currentRoleDef.permissions.length})
              </Text>
              <View style={styles.permissionList}>
                {currentRoleDef.permissions.map((perm) => (
                  <View key={perm} style={styles.permissionRow}>
                    <Text style={styles.check}>✓</Text>
                    <View style={styles.permTextWrap}>
                      <Text style={styles.permCode}>{perm}</Text>
                      <Text style={styles.permDescription}>
                        {getPermissionDescription(perm)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          /* ================================================================= */
          /* 2. USER ROLE ASSIGNMENT TAB (JN-238) */
          /* ================================================================= */
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search staff to update role..."
                placeholderTextColor={colors.textSoft}
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Text style={styles.clearSearch}>✕</Text>
                </Pressable>
              )}
            </View>

            {loadingStaff ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.royal[700]} />
                <Text style={styles.loadingText}>Loading accounts...</Text>
              </View>
            ) : filteredStaff.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No matching users</Text>
                <Text style={styles.emptySubtitle}>
                  Search by name, email, or department to find staff members.
                </Text>
              </View>
            ) : (
              <View style={styles.userList}>
                {filteredStaff.map((staff) => (
                  <View key={staff.id} style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarIcon}>
                          {getRoleIcon(staff.role)}
                        </Text>
                      </View>

                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{staff.fullName}</Text>
                        <Text style={styles.userEmail}>{staff.email}</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.userCardFooter}>
                      <View style={styles.roleBadgeCurrent}>
                        <Text style={styles.roleBadgeCurrentText}>
                          Current: {getRoleLabel(staff.role)}
                        </Text>
                      </View>

                      <Pressable
                        style={styles.changeRoleBtn}
                        onPress={() => openRoleChangeModal(staff)}
                        accessibilityRole="button"
                        accessibilityLabel={`Change role for ${staff.fullName}`}
                      >
                        <Text style={styles.changeRoleBtnText}>✏️ Change Role</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* ================================================================= */}
        {/* ROLE ASSIGNMENT & PERMISSION DIFF MODAL (JN-238, JN-241, JN-242) */}
        {/* ================================================================= */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign System Role</Text>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={styles.closeModalBtn}
                >
                  <Text style={styles.closeModalText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalBody}
              >
                {targetStaff && (
                  <View style={styles.targetUserBox}>
                    <Text style={styles.targetUserName}>{targetStaff.fullName}</Text>
                    <Text style={styles.targetUserEmail}>{targetStaff.email}</Text>
                    <Text style={styles.targetCurrentRole}>
                      Current Role: <Text style={styles.bold}>{targetStaff.role}</Text>
                    </Text>
                  </View>
                )}

                {/* Role Selector Grid */}
                <Text style={styles.sectionLabel}>Select New Role:</Text>
                <View style={styles.rolePickerGrid}>
                  {roles.map((r) => {
                    const isSelected = proposedRole === r.id;
                    const isCurrent = targetStaff?.role === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        style={[
                          styles.roleOptionCard,
                          isSelected && styles.roleOptionActive,
                        ]}
                        onPress={() => {
                          setProposedRole(r.id);
                          setModalError("");
                        }}
                      >
                        <View style={styles.roleOptionHeader}>
                          <Text style={styles.roleOptionIcon}>{r.icon}</Text>
                          <Text
                            style={[
                              styles.roleOptionName,
                              isSelected && styles.roleOptionNameActive,
                            ]}
                          >
                            {r.label}
                          </Text>
                        </View>
                        {isCurrent && (
                          <Text style={styles.currentBadge}>Current Assigned Role</Text>
                        )}
                        <Text style={styles.roleOptionDesc}>{r.description}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Live Permission Differential Preview (JN-241 & JN-242) */}
                {permissionDiff && targetStaff?.role !== proposedRole && (
                  <View style={styles.diffCard}>
                    <Text style={styles.diffTitle}>🛡️ Live Permission Impact</Text>

                    {permissionDiff.gained.length > 0 && (
                      <View style={styles.diffGroup}>
                        <Text style={styles.diffGainedHeader}>
                          + Permissions Gained ({permissionDiff.gained.length}):
                        </Text>
                        {permissionDiff.gained.map((p) => (
                          <Text key={p} style={styles.diffGainedText}>
                            + {p}
                          </Text>
                        ))}
                      </View>
                    )}

                    {permissionDiff.removed.length > 0 && (
                      <View style={styles.diffGroup}>
                        <Text style={styles.diffRemovedHeader}>
                          - Permissions Lost ({permissionDiff.removed.length}):
                        </Text>
                        {permissionDiff.removed.map((p) => (
                          <Text key={p} style={styles.diffRemovedText}>
                            - {p}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Reason Input */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Reason for Role Change (Audit Log)</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g. Promoted to Digital Evidence Validator"
                    placeholderTextColor={colors.textSoft}
                    style={styles.formInput}
                  />
                </View>

                {/* Modal Error Message */}
                {modalError !== "" && (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorText}>{modalError}</Text>
                  </View>
                )}

                {/* Modal Actions */}
                <View style={styles.modalActionRow}>
                  <Pressable
                    style={styles.modalCancelBtn}
                    onPress={() => setModalVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalSubmitBtn,
                      submitting && styles.btnDisabled,
                    ]}
                    onPress={handleApplyRoleChange}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.textInverse} />
                    ) : (
                      <Text style={styles.modalSubmitText}>Confirm & Apply Role</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

function getRoleLabel(role: SystemRole): string {
  switch (role) {
    case "reporter":
      return "Registered Reporter";
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

function getRoleIcon(role: SystemRole): string {
  switch (role) {
    case "reporter":
      return "📝";
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

function getPermissionDescription(permission: string): string {
  switch (permission) {
    case "report:create":
      return "Submit new human-rights incident reports with metadata.";
    case "report:read:own":
      return "View cases submitted by the reporter's own account.";
    case "report:read:all":
      return "View all submitted reports across the organization.";
    case "report:update":
      return "Modify and update case details and classifications.";
    case "report:delete":
      return "Remove or archive invalid case submissions.";
    case "evidence:upload":
      return "Upload photo, video, audio, or document evidence assets.";
    case "evidence:verify":
      return "Inspect, validate, and record forensic decisions on evidence.";
    case "evidence:delete":
      return "Purge non-compliant or hazardous evidence attachments.";
    case "admin:roles:read":
      return "Inspect all system roles, capabilities, and user assignments.";
    case "admin:roles:update":
      return "Modify system roles, permissions, and user assignments.";
    case "admin:users:manage":
      return "Invite, activate, deactivate, or configure staff accounts.";
    case "admin:audit_logs:read":
      return "Inspect tamper-evident system and access audit trails.";
    default:
      return "Granted system operation permission.";
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
  modeSwitchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  modeBtnActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  modeBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  tabsContainer: {
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  tabIcon: {
    fontSize: 15,
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
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  roleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconLarge: {
    fontSize: 22,
  },
  roleTitleWrap: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  roleSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  codeText: {
    fontFamily: "monospace",
    color: colors.royal[700],
    fontWeight: "600",
  },
  roleDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: colors.textSoft,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
  },
  permissionList: {
    gap: 8,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[100],
  },
  check: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
    marginTop: 1,
  },
  permTextWrap: {
    flex: 1,
  },
  permCode: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    color: colors.royal[800],
  },
  permDescription: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
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
  loadingBox: {
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyBox: {
    padding: 36,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
  userList: {
    gap: 12,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.royal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarIcon: {
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  userCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleBadgeCurrent: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.navy[100],
  },
  roleBadgeCurrentText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[800],
  },
  changeRoleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.royal[700],
  },
  changeRoleBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textInverse,
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
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  closeModalBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalBody: {
    gap: 12,
  },
  targetUserBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.royal[50],
    borderWidth: 1,
    borderColor: colors.royal[100],
    gap: 2,
  },
  targetUserName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[900],
  },
  targetUserEmail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  targetCurrentRole: {
    fontSize: 11.5,
    color: colors.navy[800],
    marginTop: 4,
  },
  bold: {
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[800],
    marginTop: 4,
  },
  rolePickerGrid: {
    gap: 8,
  },
  roleOptionCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  roleOptionActive: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[50],
  },
  roleOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleOptionIcon: {
    fontSize: 16,
  },
  roleOptionName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[900],
  },
  roleOptionNameActive: {
    color: colors.royal[900],
  },
  currentBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.royal[700],
  },
  roleOptionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  diffCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  diffTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[900],
  },
  diffGroup: {
    gap: 2,
  },
  diffGainedHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  diffGainedText: {
    fontSize: 10.5,
    fontFamily: "monospace",
    color: "#065F46",
    marginLeft: 6,
  },
  diffRemovedHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B91C1C",
  },
  diffRemovedText: {
    fontSize: 10.5,
    fontFamily: "monospace",
    color: "#991B1B",
    marginLeft: 6,
  },
  formGroup: {
    gap: 4,
    marginTop: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  formInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: colors.navy[900],
    backgroundColor: colors.surface,
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
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  modalSubmitBtn: {
    flex: 2,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  modalSubmitText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
