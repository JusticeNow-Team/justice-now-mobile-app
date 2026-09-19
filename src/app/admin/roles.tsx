import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    getAllRoles,
    Permission,
    SystemRole,
    updateUserRole,
    useAuth,
} from "../../auth";
import { AppIcon } from "../../components/AppIcon";
import { getStaffAccounts, StaffAccount } from "../../staff";
import { colors, iconSizes } from "../../theme";

const PERMISSION_ROWS: { label: string; permission: Permission }[] = [
  { label: "Create reports", permission: "cases:create" },
  { label: "View own cases", permission: "cases:read:own" },
  { label: "View assigned cases", permission: "cases:read:assigned" },
  { label: "View all cases", permission: "cases:read:all" },
  { label: "Update case status", permission: "cases:update:status" },
  { label: "Request information", permission: "cases:request_info" },
  { label: "Upload evidence", permission: "evidence:upload:own" },
  { label: "Assign evidence", permission: "evidence:assign" },
  { label: "Validate evidence", permission: "evidence:validate" },
  { label: "Manage users", permission: "admin:users:manage" },
  { label: "Manage roles", permission: "admin:roles:manage" },
  { label: "View audit logs", permission: "admin:audit_logs:read" },
];

function roleLabel(role: SystemRole) {
  if (role === "reporter") return "Reporter";
  if (role === "case_officer") return "Case investigator";
  if (role === "evidence_checker") return "Evidence validator";
  return "System administrator";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function AdminRolesScreen() {
  const router = useRouter();
  const { user, role: administratorRole } = useAuth();
  const roles = useMemo(() => getAllRoles(), []);

  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [proposedRole, setProposedRole] = useState<SystemRole>("case_officer");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadAccounts = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setErrorMessage("");
      const result = await getStaffAccounts();
      setAccounts(result);

      setSelectedId((current) => {
        if (current && result.some((account) => account.id === current)) {
          return current;
        }
        return result[0]?.id || "";
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load JusticeNow accounts.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadAccounts(), 0);
    return () => clearTimeout(timer);
  }, [loadAccounts]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) || null,
    [accounts, selectedId],
  );

  useEffect(() => {
    if (selectedAccount) {
      const timer = setTimeout(() => {
        setProposedRole(selectedAccount.role);
        setReason("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedAccount]);

  const filteredAccounts = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return accounts.slice(0, 50);

    return accounts
      .filter((account) =>
        [account.fullName, account.email, account.id, roleLabel(account.role)]
          .join(" ")
          .toLowerCase()
          .includes(value),
      )
      .slice(0, 50);
  }, [accounts, search]);

  const proposedConfig = useMemo(
    () => roles.find((item) => item.id === proposedRole) || roles[0],
    [proposedRole, roles],
  );

  const saveRole = async () => {
    if (!selectedAccount) return;

    if (selectedAccount.role === proposedRole) {
      Alert.alert("No change", "Select a different role before saving.");
      return;
    }

    try {
      setSaving(true);
      const result = await updateUserRole({
        actorUserId: user?.id,
        actorUserEmail: user?.email,
        actorRole: administratorRole,
        targetUserId: selectedAccount.id,
        targetUserEmail: selectedAccount.email,
        targetCurrentRole: selectedAccount.role,
        newRole: proposedRole,
        reason: reason.trim() || "Administrative role assignment",
      });

      if (!result.success || !result.newRole) {
        Alert.alert(
          "Role change failed",
          result.error || "The account role could not be changed.",
        );
        return;
      }

      setAccounts((current) =>
        current.map((account) =>
          account.id === selectedAccount.id
            ? {
                ...account,
                role: result.newRole!,
                updatedAt: new Date().toISOString(),
              }
            : account,
        ),
      );
      setReason("");

      const gained = result.permissionDiff?.gained.length || 0;
      const removed = result.permissionDiff?.removed.length || 0;
      Alert.alert(
        "Role updated",
        `${selectedAccount.fullName} is now ${roleLabel(result.newRole)}. ${gained} permissions gained and ${removed} removed.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace("/admin/settings")}
          accessibilityLabel="Back to settings"
          style={styles.headerButton}
        >
          <AppIcon
            name="chevron-left"
            size={iconSizes.headerBack}
            color={colors.navy[700]}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Roles & permissions</Text>
          <Text style={styles.headerSubtitle}>
            Assign accountable, least-privilege access
          </Text>
        </View>

        <Pressable
          onPress={() => void loadAccounts()}
          accessibilityLabel="Refresh accounts"
          style={styles.headerButton}
        >
          <AppIcon
            name="refresh-cw"
            size={iconSizes.md}
            color={colors.navy[700]}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadAccounts(false);
            }}
          />
        }
      >
        <View style={styles.roleSummaryCard}>
          <Text style={styles.cardTitle}>JusticeNow roles</Text>
          <Text style={styles.cardDescription}>
            Account totals are loaded from the Supabase profiles table.
          </Text>

          {roles.map((roleConfig, index) => (
            <View
              key={roleConfig.id}
              style={[
                styles.roleSummaryRow,
                index === roles.length - 1 && styles.lastRow,
              ]}
            >
              <View style={styles.summaryIcon}>
                <AppIcon
                  name={roleConfig.icon}
                  size={18}
                  color={colors.royal[700]}
                />
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.roleName}>{roleLabel(roleConfig.id)}</Text>
                <Text style={styles.roleDescription} numberOfLines={2}>
                  {roleConfig.description}
                </Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {
                    accounts.filter((account) => account.role === roleConfig.id)
                      .length
                  }
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assign a role</Text>
          <Text style={styles.sectionHint}>Changes are audited</Text>
        </View>

        <View style={styles.searchBox}>
          <AppIcon name="search" size={17} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search account by name, email or ID"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <AppIcon name="x" size={17} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.royal[700]} />
            <Text style={styles.stateText}>Loading accounts...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <AppIcon name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountRow}
          >
            {filteredAccounts.map((account) => {
              const active = account.id === selectedId;
              return (
                <Pressable
                  key={account.id}
                  onPress={() => setSelectedId(account.id)}
                  style={[
                    styles.accountCard,
                    active && styles.accountCardActive,
                  ]}
                >
                  <View style={[styles.avatar, active && styles.avatarActive]}>
                    <Text
                      style={[
                        styles.avatarText,
                        active && styles.avatarTextActive,
                      ]}
                    >
                      {initials(account.fullName) || "U"}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.accountName,
                      active && styles.accountNameActive,
                    ]}
                  >
                    {account.fullName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.accountRole,
                      active && styles.accountRoleActive,
                    ]}
                  >
                    {roleLabel(account.role)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {selectedAccount ? (
          <View style={styles.assignmentCard}>
            <View style={styles.selectedIdentity}>
              <View style={styles.selectedAvatar}>
                <Text style={styles.selectedAvatarText}>
                  {initials(selectedAccount.fullName)}
                </Text>
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.selectedName}>
                  {selectedAccount.fullName}
                </Text>
                <Text style={styles.selectedEmail} numberOfLines={1}>
                  {selectedAccount.email}
                </Text>
              </View>
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>
                  {roleLabel(selectedAccount.role)}
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>New role</Text>
            <View style={styles.roleOptions}>
              {roles.map((roleConfig) => {
                const selected = proposedRole === roleConfig.id;
                return (
                  <Pressable
                    key={roleConfig.id}
                    onPress={() => setProposedRole(roleConfig.id)}
                    style={[
                      styles.roleOption,
                      selected && styles.roleOptionSelected,
                    ]}
                  >
                    <AppIcon
                      name={roleConfig.icon}
                      size={18}
                      color={selected ? colors.textInverse : colors.royal[700]}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        selected && styles.roleOptionTextSelected,
                      ]}
                    >
                      {roleLabel(roleConfig.id)}
                    </Text>
                    <AppIcon
                      name={selected ? "circle-check" : "circle"}
                      size={18}
                      color={selected ? colors.textInverse : colors.navy[300]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for changing this role"
              placeholderTextColor={colors.textSoft}
              maxLength={300}
              multiline
              textAlignVertical="top"
              style={styles.reasonInput}
            />

            <View style={styles.permissionPreview}>
              <View style={styles.previewHeader}>
                <AppIcon
                  name="shield-check"
                  size={19}
                  color={colors.teal[700]}
                />
                <Text style={styles.previewTitle}>
                  {roleLabel(proposedRole)} permission preview
                </Text>
              </View>
              <Text style={styles.previewText}>
                {proposedConfig.permissions.length} permissions will be
                inherited from this role. Backend RLS remains the final
                enforcement layer.
              </Text>
            </View>

            <Pressable
              onPress={() => void saveRole()}
              disabled={saving || selectedAccount.role === proposedRole}
              style={[
                styles.saveButton,
                (saving || selectedAccount.role === proposedRole) &&
                  styles.saveButtonDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <AppIcon name="check" size={18} color={colors.textInverse} />
                  <Text style={styles.saveButtonText}>
                    Save role assignment
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Permission matrix</Text>
          <Text style={styles.sectionHint}>Read-only security baseline</Text>
        </View>

        <View style={styles.matrixCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.matrix}>
              <View style={styles.matrixHeader}>
                <Text style={styles.permissionHeader}>PERMISSION</Text>
                {roles.map((roleConfig) => (
                  <Text key={roleConfig.id} style={styles.roleHeader}>
                    {roleConfig.id === "reporter"
                      ? "R"
                      : roleConfig.id === "case_officer"
                        ? "I"
                        : roleConfig.id === "evidence_checker"
                          ? "V"
                          : "A"}
                  </Text>
                ))}
              </View>

              {PERMISSION_ROWS.map((row) => (
                <View key={row.permission} style={styles.matrixRow}>
                  <Text style={styles.permissionName}>{row.label}</Text>
                  {roles.map((roleConfig) => {
                    const allowed = roleConfig.permissions.includes(
                      row.permission,
                    );
                    return (
                      <View key={roleConfig.id} style={styles.permissionCell}>
                        <View
                          style={[
                            styles.permissionMark,
                            allowed
                              ? styles.permissionAllowed
                              : styles.permissionDenied,
                          ]}
                        >
                          <AppIcon
                            name={allowed ? "check" : "x"}
                            size={13}
                            color={allowed ? colors.success : colors.navy[300]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.notice}>
          <AppIcon name="info" size={19} color={colors.warning} />
          <Text style={styles.noticeText}>
            Individual permission switches are intentionally read-only. Changing
            backend authorization requires reviewed RLS and application-policy
            changes, not only a visual toggle.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flexOne: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerText: { flex: 1, paddingHorizontal: 4 },
  headerTitle: { color: colors.navy[800], fontSize: 18, fontWeight: "800" },
  headerSubtitle: { marginTop: 2, color: colors.textSecondary, fontSize: 11.5 },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 34 },
  roleSummaryCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.navy[800], fontSize: 15, fontWeight: "800" },
  cardDescription: {
    marginTop: 3,
    marginBottom: 8,
    color: colors.textSecondary,
    fontSize: 11.5,
  },
  roleSummaryRow: {
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  summaryIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.royal[50],
  },
  roleName: { color: colors.navy[800], fontSize: 13, fontWeight: "700" },
  roleDescription: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 10.5,
    lineHeight: 15,
  },
  countBadge: {
    minWidth: 32,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: colors.navy[50],
  },
  countText: { color: colors.navy[700], fontSize: 12, fontWeight: "800" },
  sectionHeader: {
    marginTop: 21,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    flex: 1,
    color: colors.navy[800],
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHint: { color: colors.textSecondary, fontSize: 10.5 },
  searchBox: {
    minHeight: 45,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 13,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 12.5 },
  stateCard: {
    marginTop: 10,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  stateText: { color: colors.textSecondary, fontSize: 12 },
  errorCard: {
    marginTop: 10,
    padding: 14,
    flexDirection: "row",
    gap: 9,
    borderWidth: 1,
    borderColor: "#F0B7B3",
    borderRadius: 14,
    backgroundColor: "#FFF2F1",
  },
  errorText: { flex: 1, color: colors.error, fontSize: 12, lineHeight: 17 },
  accountRow: { marginTop: 10, gap: 9, paddingRight: 8 },
  accountCard: {
    width: 145,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  accountCardActive: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[700],
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.navy[50],
  },
  avatarActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  avatarText: { color: colors.navy[700], fontSize: 11.5, fontWeight: "800" },
  avatarTextActive: { color: colors.textInverse },
  accountName: {
    marginTop: 9,
    color: colors.navy[800],
    fontSize: 12.5,
    fontWeight: "700",
  },
  accountNameActive: { color: colors.textInverse },
  accountRole: { marginTop: 3, color: colors.textSecondary, fontSize: 10.5 },
  accountRoleActive: { color: colors.royal[100] },
  assignmentCard: {
    marginTop: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  selectedIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedAvatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.navy[800],
  },
  selectedAvatarText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: "800",
  },
  selectedName: { color: colors.navy[800], fontSize: 13.5, fontWeight: "800" },
  selectedEmail: { marginTop: 2, color: colors.textSecondary, fontSize: 10.5 },
  currentBadge: {
    maxWidth: 110,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.teal[50],
  },
  currentBadgeText: {
    color: colors.teal[700],
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
  },
  fieldLabel: {
    marginTop: 15,
    marginBottom: 7,
    color: colors.navy[800],
    fontSize: 11.5,
    fontWeight: "800",
  },
  roleOptions: { gap: 8 },
  roleOption: {
    minHeight: 45,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  roleOptionSelected: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },
  roleOptionText: {
    flex: 1,
    color: colors.navy[800],
    fontSize: 12.5,
    fontWeight: "700",
  },
  roleOptionTextSelected: { color: colors.textInverse },
  reasonInput: {
    minHeight: 78,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    color: colors.textPrimary,
    fontSize: 12,
    backgroundColor: colors.surface,
  },
  permissionPreview: {
    marginTop: 13,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.teal[50],
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewTitle: { color: colors.teal[800], fontSize: 12, fontWeight: "800" },
  previewText: {
    marginTop: 5,
    color: colors.teal[700],
    fontSize: 10.5,
    lineHeight: 15,
  },
  saveButton: {
    minHeight: 48,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 13,
    backgroundColor: colors.royal[700],
  },
  saveButtonDisabled: { opacity: 0.42 },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: "800",
  },
  matrixCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  matrix: { minWidth: 420 },
  matrixHeader: { minHeight: 34, flexDirection: "row", alignItems: "center" },
  permissionHeader: {
    width: 230,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
  },
  roleHeader: {
    width: 45,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  matrixRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  permissionName: {
    width: 230,
    paddingRight: 8,
    color: colors.navy[800],
    fontSize: 11.5,
    fontWeight: "600",
  },
  permissionCell: { width: 45, alignItems: "center" },
  permissionMark: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  permissionAllowed: { backgroundColor: "#E8F6F0" },
  permissionDenied: { backgroundColor: colors.navy[50] },
  notice: {
    marginTop: 13,
    padding: 13,
    flexDirection: "row",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.gold[200],
    borderRadius: 13,
    backgroundColor: colors.gold[50],
  },
  noticeText: {
    flex: 1,
    color: colors.navy[700],
    fontSize: 10.8,
    lineHeight: 16,
  },
});
