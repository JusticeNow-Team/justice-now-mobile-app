import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { useAuth } from "../../auth";
import { AppIcon } from "../../components/AppIcon";
import {
  canDeactivateStaff,
  checkDuplicateStaffEmail,
  createStaffAccount,
  getStaffAccounts,
  StaffAccount,
  StaffRole,
  toggleStaffActive,
  validateStaffInput,
} from "../../staff";
import { colors, iconSizes } from "../../theme";

type RoleTab =
  | "all"
  | "reporter"
  | "case_officer"
  | "evidence_checker"
  | "system_admin";

type StatusFilter = "all" | "active" | "inactive" | "suspended";

const CREATE_ROLES: {
  value: StaffRole;
  label: string;
}[] = [
  {
    value: "case_officer",
    label: "Case investigator",
  },
  {
    value: "evidence_checker",
    label: "Evidence validator",
  },
  {
    value: "system_admin",
    label: "System administrator",
  },
];

function roleLabel(role: StaffRole) {
  switch (role) {
    case "reporter":
      return "Reporter";
    case "case_officer":
      return "Case investigator";
    case "evidence_checker":
      return "Evidence validator";
    case "system_admin":
      return "System administrator";
    default:
      return "User";
  }
}

function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function statusLabel(staff: StaffAccount) {
  if (staff.status === "suspended") {
    return "Suspended";
  }

  return staff.isActive ? "Active" : "Inactive";
}

function formatLastActive(staff: StaffAccount) {
  if (!staff.lastLoginAt) {
    return "Not recorded";
  }

  const date = new Date(staff.lastLoginAt);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminStaffScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleTab, setRoleTab] = useState<RoleTab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("case_officer");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const accounts = await getStaffAccounts();
      setStaff(accounts);
    } catch (error) {
      console.error("Unable to load user accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStaff();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadStaff]);

  const counts = useMemo(
    () => ({
      all: staff.length,
      reporter: staff.filter((item) => item.role === "reporter").length,
      case_officer: staff.filter((item) => item.role === "case_officer").length,
      evidence_checker: staff.filter((item) => item.role === "evidence_checker")
        .length,
      system_admin: staff.filter((item) => item.role === "system_admin").length,
    }),
    [staff],
  );

  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return staff.filter((item) => {
      const roleMatches = roleTab === "all" || item.role === roleTab;

      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" &&
          !item.isActive &&
          item.status !== "suspended") ||
        (statusFilter === "suspended" && item.status === "suspended");

      const searchMatches =
        !query ||
        item.fullName.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query);

      return roleMatches && statusMatches && searchMatches;
    });
  }, [roleTab, searchQuery, staff, statusFilter]);

  const tabs: {
    id: RoleTab;
    label: string;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All users",
      count: counts.all,
    },
    {
      id: "reporter",
      label: "Reporters",
      count: counts.reporter,
    },
    {
      id: "case_officer",
      label: "Investigators",
      count: counts.case_officer,
    },
    {
      id: "evidence_checker",
      label: "Validators",
      count: counts.evidence_checker,
    },
    {
      id: "system_admin",
      label: "Admins",
      count: counts.system_admin,
    },
  ];

  const changeStatusFilter = () => {
    const filters: StatusFilter[] = ["all", "active", "inactive", "suspended"];

    const currentIndex = filters.indexOf(statusFilter);
    const nextIndex = (currentIndex + 1) % filters.length;
    setStatusFilter(filters[nextIndex]);
  };

  const resetAddForm = () => {
    setFullName("");
    setEmail("");
    setNewRole("case_officer");
    setDepartment("");
    setPhone("");
    setPassword("");
    setFormError("");
  };

  const closeAddModal = () => {
    if (creating) {
      return;
    }

    setShowAddModal(false);
    resetAddForm();
  };

  const createAccount = async () => {
    setFormError("");

    const input = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: newRole,
      department: department.trim(),
      phone: phone.trim(),
      password: password || undefined,
      isActive: true,
    };

    const validation = validateStaffInput(input);

    if (!validation.isValid) {
      setFormError(validation.errors.join(" "));
      return;
    }

    const duplicate = checkDuplicateStaffEmail(input.email, staff);

    if (duplicate.isDuplicate) {
      setFormError(
        duplicate.error || "This email address is already registered.",
      );
      return;
    }

    try {
      setCreating(true);

      const result = await createStaffAccount(
        input,
        user?.email || "admin@justicenow.org",
      );

      if (!result.success || !result.staff) {
        setFormError(result.error || "The account could not be created.");
        return;
      }

      setStaff((current) => [result.staff!, ...current]);
      setShowAddModal(false);
      resetAddForm();

      Alert.alert(
        "Account created",
        `${result.staff.fullName} was added successfully.`,
      );
    } catch (error: any) {
      setFormError(error?.message || "The account could not be created.");
    } finally {
      setCreating(false);
    }
  };

  const executeStatusUpdate = async (
    account: StaffAccount,
    active: boolean,
  ) => {
    try {
      setUpdatingStatus(true);

      const result = await toggleStaffActive(
        account.id,
        active,
        user?.email || "admin@justicenow.org",
        active
          ? "Account activated by administrator"
          : "Account suspended by administrator",
      );

      if (!result.success) {
        Alert.alert(
          "Update failed",
          result.error || "The account could not be updated.",
        );
        return;
      }

      const updated =
        result.staff ||
        ({
          ...account,
          isActive: active,
          status: active ? "active" : "inactive",
        } as StaffAccount);

      setStaff((current) =>
        current.map((item) => (item.id === account.id ? updated : item)),
      );

      setSelectedStaff(updated);
    } catch (error: any) {
      Alert.alert(
        "Update failed",
        error?.message || "The account could not be updated.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const requestStatusUpdate = (account: StaffAccount) => {
    const activate = !account.isActive;

    if (!activate) {
      const guard = canDeactivateStaff(account, user?.id);

      if (!guard.allowed) {
        Alert.alert(
          "Action blocked",
          guard.reason || "This account cannot be deactivated.",
        );
        return;
      }
    }

    const message = activate
      ? `Activate ${account.fullName}'s account?`
      : `Suspend ${account.fullName}'s account? They will be unable to sign in.`;

    if (Platform.OS === "web") {
      if (window.confirm(message)) {
        void executeStatusUpdate(account, activate);
      }

      return;
    }

    Alert.alert(activate ? "Activate account" : "Suspend account", message, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: activate ? "Activate" : "Suspend",
        style: activate ? "default" : "destructive",
        onPress: () => {
          void executeStatusUpdate(account, activate);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace("/admin")}
          accessibilityRole="button"
          accessibilityLabel="Back to administrator dashboard"
        >
          <AppIcon name="chevron-left" size={20} color={colors.navy[700]} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>User management</Text>
          <Text style={styles.headerSubtitle}>
            {staff.length.toLocaleString()} accounts
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <AppIcon name="user-plus" size={15} color={colors.textInverse} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchBar}>
          <AppIcon name="search" size={16} color={colors.textSecondary} />

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholder="Search name, user ID or email"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <AppIcon name="x" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((tab) => {
            const active = tab.id === roleTab;

            return (
              <Pressable
                key={tab.id}
                style={[styles.tab, active && styles.activeTab]}
                onPress={() => setRoleTab(tab.id)}
              >
                <Text
                  style={[styles.tabLabel, active && styles.activeTabLabel]}
                >
                  {tab.label}
                </Text>

                <Text
                  style={[styles.tabCount, active && styles.activeTabCount]}
                >
                  {tab.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <View style={styles.filterButton}>
            <AppIcon name="filter" size={iconSizes.xs} color={colors.navy[700]} />
            <Text style={styles.filterStrongText}>Filters</Text>
          </View>

          <View style={styles.filterButton}>
            <Text style={styles.filterText}>Role: All</Text>
          </View>

          <Pressable style={styles.filterButton} onPress={changeStatusFilter}>
            <Text style={styles.filterText}>
              Status:{" "}
              {statusFilter === "all"
                ? "All"
                : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </Text>
          </Pressable>

          <View style={styles.filterButton}>
            <Text style={styles.filterText}>Verification: All</Text>
          </View>
        </ScrollView>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading user accounts...</Text>
          </View>
        ) : filteredStaff.length === 0 ? (
          <View style={styles.loadingState}>
            <AppIcon name="users" size={28} color={colors.textSoft} />
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.loadingText}>
              Change the search text or selected filters.
            </Text>
          </View>
        ) : (
          <View style={styles.userList}>
            {filteredStaff.map((account) => {
              const status = statusLabel(account);
              const active = status === "Active";
              const suspended = status === "Suspended";

              return (
                <Pressable
                  key={account.id}
                  style={styles.userCard}
                  onPress={() =>
                    router.push(`/admin/staff/${account.id}` as any)
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {initials(account.fullName) || "U"}
                    </Text>
                  </View>

                  <View style={styles.userInformation}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {account.fullName}
                      </Text>

                      {account.isActive ? (
                        <AppIcon
                          name="check-circle"
                          size={13}
                          color={colors.success}
                        />
                      ) : null}
                    </View>

                    <Text style={styles.userMeta} numberOfLines={1}>
                      {account.id} · {roleLabel(account.role)}
                    </Text>

                    <Text style={styles.lastActive}>
                      Last active {formatLastActive(account)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      active
                        ? styles.activeBadge
                        : suspended
                          ? styles.suspendedBadge
                          : styles.inactiveBadge,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: active
                            ? colors.success
                            : suspended
                              ? colors.error
                              : colors.textSoft,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: active
                            ? colors.success
                            : suspended
                              ? colors.error
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {status}
                    </Text>
                  </View>

                  <AppIcon
                    name="chevron-right"
                    size={16}
                    color={colors.navy[300]}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={selectedStaff !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStaff(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            {selectedStaff ? (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Account details</Text>
                    <Text style={styles.modalSubtitle}>{selectedStaff.id}</Text>
                  </View>

                  <Pressable onPress={() => setSelectedStaff(null)}>
                    <AppIcon name="x" size={20} color={colors.navy[700]} />
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.detailIdentity}>
                    <View style={styles.largeAvatar}>
                      <Text style={styles.largeAvatarText}>
                        {initials(selectedStaff.fullName)}
                      </Text>
                    </View>

                    <Text style={styles.detailName}>
                      {selectedStaff.fullName}
                    </Text>
                    <Text style={styles.detailRole}>
                      {roleLabel(selectedStaff.role)}
                    </Text>
                  </View>

                  <View style={styles.detailRows}>
                    <DetailRow label="Email" value={selectedStaff.email} />
                    <DetailRow
                      label="Department"
                      value={selectedStaff.department || "Not provided"}
                    />
                    <DetailRow
                      label="Phone"
                      value={selectedStaff.phone || "Not provided"}
                    />
                    <DetailRow
                      label="Status"
                      value={statusLabel(selectedStaff)}
                    />
                    <DetailRow
                      label="Last active"
                      value={formatLastActive(selectedStaff)}
                    />
                  </View>

                  <Pressable
                    style={[
                      styles.statusAction,
                      selectedStaff.isActive
                        ? styles.deactivateButton
                        : styles.activateButton,
                    ]}
                    onPress={() => requestStatusUpdate(selectedStaff)}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator
                        color={
                          selectedStaff.isActive
                            ? colors.error
                            : colors.textInverse
                        }
                      />
                    ) : (
                      <Text
                        style={[
                          styles.statusActionText,
                          selectedStaff.isActive
                            ? styles.deactivateButtonText
                            : styles.activateButtonText,
                        ]}
                      >
                        {selectedStaff.isActive
                          ? "Suspend account"
                          : "Activate account"}
                      </Text>
                    )}
                  </Pressable>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add staff account</Text>
                <Text style={styles.modalSubtitle}>
                  Create a new authorised account
                </Text>
              </View>

              <Pressable onPress={closeAddModal} disabled={creating}>
                <AppIcon name="x" size={20} color={colors.navy[700]} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {formError ? (
                <View style={styles.errorNotice}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <FormField
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
              />

              <FormField
                label="Work email"
                value={email}
                onChangeText={setEmail}
                placeholder="name@justicenow.org"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Role</Text>

              <View style={styles.roleOptions}>
                {CREATE_ROLES.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.roleOption,
                      newRole === option.value && styles.selectedRoleOption,
                    ]}
                    onPress={() => setNewRole(option.value)}
                  >
                    <View
                      style={[
                        styles.radio,
                        newRole === option.value && styles.selectedRadio,
                      ]}
                    >
                      {newRole === option.value ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>

                    <Text style={styles.roleOptionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>

              <FormField
                label="Department"
                value={department}
                onChangeText={setDepartment}
                placeholder="e.g. Investigations"
              />

              <FormField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+94 7X XXX XXXX"
                keyboardType="phone-pad"
              />

              <FormField
                label="Temporary password"
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 characters"
                secureTextEntry
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeAddModal}
                  disabled={creating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.createButton}
                  onPress={() => void createAccount()}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <>
                      <AppIcon
                        name="user-plus"
                        size={16}
                        color={colors.textInverse}
                      />
                      <Text style={styles.createButtonText}>Create</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

function FormField({
  label,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor={colors.textSoft}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.navy[800],
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.royal[700],
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  searchBar: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 0,
    fontSize: 14,
    color: colors.navy[800],
    outlineStyle: "none",
  } as any,
  tabs: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activeTab: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },
  activeTabLabel: {
    color: colors.textInverse,
  },
  tabCount: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSoft,
  },
  activeTabCount: {
    color: colors.navy[100],
  },
  filters: {
    paddingTop: 6,
    paddingBottom: 4,
    gap: 8,
  },
  filterButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterStrongText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[700],
  },
  filterText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  userList: {
    paddingTop: 10,
    gap: 10,
  },
  userCard: {
    minHeight: 82,
    padding: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.navy[900],
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[100],
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.navy[700],
  },
  userInformation: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  userName: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  userMeta: {
    marginTop: 3,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  lastActive: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSoft,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  activeBadge: {
    borderColor: "#D2EDE1",
    backgroundColor: "#EAF6F0",
  },
  suspendedBadge: {
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
  },
  inactiveBadge: {
    borderColor: colors.border,
    backgroundColor: colors.navy[50],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  loadingState: {
    minHeight: 220,
    marginTop: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  loadingText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  modalOverlay: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,27,46,0.58)",
  },
  detailModal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  addModal: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  modalContent: {
    padding: 18,
    gap: 14,
  },
  detailIdentity: {
    alignItems: "center",
    paddingBottom: 8,
  },
  largeAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[100],
  },
  largeAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.navy[700],
  },
  detailName: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },
  detailRole: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailRows: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  detailRowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  statusAction: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  activateButton: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },
  deactivateButton: {
    borderColor: "#F6DAD6",
    backgroundColor: colors.surface,
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  activateButtonText: {
    color: colors.textInverse,
  },
  deactivateButtonText: {
    color: colors.error,
  },
  errorNotice: {
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
  },
  errorText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.error,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
    fontSize: 13.5,
    color: colors.navy[800],
    outlineStyle: "none",
  } as any,
  roleOptions: {
    gap: 7,
  },
  roleOption: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedRoleOption: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[50],
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.navy[200],
  },
  selectedRadio: {
    borderColor: colors.royal[700],
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.royal[700],
  },
  roleOptionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  modalActions: {
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
  },
  cancelButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },
  createButton: {
    minWidth: 110,
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.royal[700],
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
