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
import {
  createCategory,
  deleteCategory,
  getCategories,
  ReportCategory,
  toggleCategoryActive,
  updateCategory,
} from "../../categories";
import { canDeleteCategory, slugifyCategoryCode } from "../../categories/validation";
import { AppIcon, AppIconName, isAppIconName } from "../../components/AppIcon";
import { colors } from "../../theme";

const POPULAR_ICONS: { name: AppIconName; label: string }[] = [
  { name: "category", label: "Tag" },
  { name: "scale", label: "Justice" },
  { name: "lock", label: "Security" },
  { name: "shield", label: "Protection" },
  { name: "shield-alert", label: "Emergency" },
  { name: "document", label: "Document" },
  { name: "activity", label: "Health" },
  { name: "message-square", label: "Speech" },
  { name: "alert-triangle", label: "Harassment" },
  { name: "users", label: "Community" },
];

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isAuthorized = userRole === "system_admin";

  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createHint, setCreateHint] = useState("");
  const [createIcon, setCreateIcon] = useState<AppIconName>("category");
  const [createIsActive, setCreateIsActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Modal State
  const [editingCategory, setEditingCategory] = useState<ReportCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editHint, setEditHint] = useState("");
  const [editIcon, setEditIcon] = useState<AppIconName>("category");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Safe Deletion Blocked Modal State
  const [blockedModal, setBlockedModal] = useState<{
    visible: boolean;
    category: ReportCategory | null;
    reason: string;
    activeCaseCount: number;
  }>({
    visible: false,
    category: null,
    reason: "",
    activeCaseCount: 0,
  });

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const records = await getCategories({
        statusFilter,
        searchQuery: searchQuery.trim() || undefined,
      });
      setCategories(records);
    } catch (error) {
      console.error("Unable to load report categories:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadCategories]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const inactive = total - active;
    const totalCases = categories.reduce((sum, c) => sum + (c.activeCaseCount ?? 0), 0);
    return { total, active, inactive, totalCases };
  }, [categories]);

  // Actor payload for auditing
  const actor = useMemo(
    () => ({
      userId: user?.id,
      email: user?.email,
      role: user?.role,
    }),
    [user],
  );

  // Reset Create Form
  const resetCreateForm = () => {
    setCreateName("");
    setCreateCode("");
    setCreateDescription("");
    setCreateHint("");
    setCreateIcon("category");
    setCreateIsActive(true);
    setCreateError("");
  };

  const openCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    resetCreateForm();
  };

  // Open Edit Modal
  const openEditModal = (cat: ReportCategory) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditDescription(cat.description);
    setEditHint(cat.hint || "");
    setEditIcon(isAppIconName(cat.icon ?? "") ? (cat.icon as AppIconName) : "category");
    setEditIsActive(cat.isActive);
    setEditError("");
  };

  const closeEditModal = () => {
    if (updating) return;
    setEditingCategory(null);
    setEditError("");
  };

  // Handle Create Category (JN-380)
  const handleCreateCategory = async () => {
    setCreateError("");

    if (!createName.trim()) {
      setCreateError("Category name is required.");
      return;
    }

    if (!createDescription.trim()) {
      setCreateError("Category description is required.");
      return;
    }

    try {
      setCreating(true);
      const codeToUse =
        createCode.trim().toLowerCase() || slugifyCategoryCode(createName);

      const result = await createCategory(
        {
          name: createName.trim(),
          code: codeToUse,
          description: createDescription.trim(),
          hint: createHint.trim() || undefined,
          icon: createIcon,
          isActive: createIsActive,
          displayOrder: categories.length + 1,
        },
        actor,
      );

      if (!result.success) {
        setCreateError(result.error || "The category could not be created.");
        return;
      }

      setShowCreateModal(false);
      resetCreateForm();
      await loadCategories();
      Alert.alert("Category Created", `"${createName.trim()}" was created successfully.`);
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create category.");
    } finally {
      setCreating(false);
    }
  };

  // Handle Update Category (JN-381)
  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    setEditError("");

    if (!editName.trim()) {
      setEditError("Category name is required.");
      return;
    }

    if (!editDescription.trim()) {
      setEditError("Category description is required.");
      return;
    }

    try {
      setUpdating(true);
      const result = await updateCategory(
        editingCategory.id,
        {
          name: editName.trim(),
          description: editDescription.trim(),
          hint: editHint.trim() || undefined,
          icon: editIcon,
          isActive: editIsActive,
        },
        actor,
      );

      if (!result.success) {
        setEditError(result.error || "The category could not be updated.");
        return;
      }

      setEditingCategory(null);
      await loadCategories();
      Alert.alert("Category Updated", `"${editName.trim()}" was updated successfully.`);
    } catch (err: any) {
      setEditError(err?.message || "Failed to update category.");
    } finally {
      setUpdating(false);
    }
  };

  // Handle Toggle Active (JN-382)
  const handleToggleActive = async (category: ReportCategory) => {
    const nextVal = !category.isActive;
    const result = await toggleCategoryActive(category.id, nextVal, actor);

    if (!result.success) {
      Alert.alert("Update Failed", result.error || "Could not update status.");
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, isActive: nextVal } : c)),
    );
  };

  // Handle Delete Category (JN-383 / AC 5)
  const handleDeleteCategory = async (category: ReportCategory) => {
    const safety = canDeleteCategory(category);

    if (!safety.allowed) {
      setBlockedModal({
        visible: true,
        category,
        reason: safety.reason || "Category cannot be deleted.",
        activeCaseCount: safety.activeCaseCount || 0,
      });
      return;
    }

    Alert.alert(
      "Delete Category",
      `Are you sure you want to permanently remove "${category.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await deleteCategory(category.id, actor);
            if (!result.success) {
              Alert.alert("Deletion Failed", result.error || "Could not delete category.");
              return;
            }
            await loadCategories();
            Alert.alert("Category Deleted", `"${category.name}" was removed.`);
          },
        },
      ],
    );
  };

  // One-tap deactivation from blocked modal
  const handleDeactivateFromBlockedModal = async () => {
    if (!blockedModal.category) return;
    const cat = blockedModal.category;
    setBlockedModal((prev) => ({ ...prev, visible: false }));
    await handleToggleActive(cat);
  };

  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.unauthorizedContainer}>
          <AppIcon name="lock" size={48} color={colors.error} />
          <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
          <Text style={styles.unauthorizedSubtitle}>
            Only System Administrators have permission to manage report categories and incident classifications.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.replace("/admin")}>
            <Text style={styles.backButtonText}>Return to Admin Hub</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBackBtn}
          onPress={() => router.push("/admin")}
          accessibilityRole="button"
        >
          <AppIcon name="arrow-left" size={20} color={colors.navy[900]} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Report Categories</Text>
          <Text style={styles.headerSubtitle}>
            Incident classifications & routing
          </Text>
        </View>
        <Pressable style={styles.addButton} onPress={openCreateModal}>
          <AppIcon name="plus" size={16} color={colors.textInverse} />
          <Text style={styles.addButtonText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{stats.total}</Text>
            <Text style={styles.kpiLabel}>Total Categories</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardActive]}>
            <Text style={[styles.kpiValue, { color: colors.success }]}>{stats.active}</Text>
            <Text style={styles.kpiLabel}>Active for Intake</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardInactive]}>
            <Text style={[styles.kpiValue, { color: colors.navy[600] }]}>{stats.inactive}</Text>
            <Text style={styles.kpiLabel}>Deactivated</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: colors.royal[700] }]}>{stats.totalCases}</Text>
            <Text style={styles.kpiLabel}>Linked Cases</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <AppIcon name="search" size={18} color={colors.navy[500]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories by name, code or description..."
            placeholderTextColor={colors.navy[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <AppIcon name="x" size={16} color={colors.navy[500]} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: `All (${stats.total})` },
              { key: "active", label: `Active (${stats.active})` },
              { key: "inactive", label: `Inactive (${stats.inactive})` },
            ] as const
          ).map((filter) => {
            const isSelected = statusFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                style={[styles.filterPill, isSelected && styles.activeFilterPill]}
                onPress={() => setStatusFilter(filter.key)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.activeFilterPillText,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Category List */}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Loading report categories...</Text>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.emptyState}>
            <AppIcon name="category" size={40} color={colors.navy[400]} />
            <Text style={styles.emptyTitle}>No Categories Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "No categories match your search term. Try a different query."
                : "No categories match the active filter."}
            </Text>
            {searchQuery ? (
              <Pressable
                style={styles.emptyButton}
                onPress={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                <Text style={styles.emptyButtonText}>Clear Filters</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.emptyButton} onPress={openCreateModal}>
                <Text style={styles.emptyButtonText}>Create First Category</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.categoryList}>
            {categories.map((category) => {
              const iconGlyph = isAppIconName(category.icon ?? "")
                ? (category.icon as AppIconName)
                : "category";

              return (
                <View key={category.id} style={styles.categoryCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <AppIcon name={iconGlyph} size={22} color={colors.royal[700]} />
                    </View>

                    <View style={styles.titleContainer}>
                      <View style={styles.titleRow}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <View
                          style={[
                            styles.badge,
                            category.isActive ? styles.badgeActive : styles.badgeInactive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              category.isActive
                                ? styles.badgeTextActive
                                : styles.badgeTextInactive,
                            ]}
                          >
                            {category.isActive ? "ACTIVE" : "INACTIVE"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.codeMetaRow}>
                        <Text style={styles.codeBadge}>code: {category.code}</Text>
                        {category.isSystemDefault ? (
                          <Text style={styles.systemBadge}>Default</Text>
                        ) : null}
                        <Text style={styles.casesCountBadge}>
                          {category.activeCaseCount ?? 0} cases linked
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.categoryDescription}>
                    {category.description}
                  </Text>

                  {category.hint ? (
                    <View style={styles.hintContainer}>
                      <AppIcon name="info" size={14} color={colors.navy[600]} />
                      <Text style={styles.hintText}>
                        Reporter Guidance: {category.hint}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <View style={styles.switchGroup}>
                      <Text style={styles.switchLabel}>
                        {category.isActive ? "Active in intake" : "Hidden from intake"}
                      </Text>
                      <Switch
                        value={category.isActive}
                        onValueChange={() => void handleToggleActive(category)}
                        trackColor={{
                          false: colors.navy[200],
                          true: colors.teal[300],
                        }}
                        thumbColor={
                          category.isActive ? colors.teal[700] : colors.navy[400]
                        }
                      />
                    </View>

                    <View style={styles.actionButtons}>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => openEditModal(category)}
                        accessibilityRole="button"
                      >
                        <AppIcon name="edit" size={14} color={colors.royal[700]} />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </Pressable>

                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => void handleDeleteCategory(category)}
                        accessibilityRole="button"
                      >
                        <AppIcon name="trash" size={14} color={colors.error} />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Safety & Audit Info Card */}
        <View style={styles.infoBanner}>
          <AppIcon name="shield-check" size={20} color={colors.royal[700]} />
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Audit Trails & Classification Safety</Text>
            <Text style={styles.infoBannerText}>
              Deactivating a category hides it from new reports while preserving classifications on existing case files. All changes are automatically recorded to administrative audit logs.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* CREATE MODAL (JN-380) */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Report Category</Text>
                <Text style={styles.modalSubtitle}>
                  Configure a new case classification
                </Text>
              </View>
              <Pressable onPress={closeCreateModal} disabled={creating}>
                <AppIcon name="x" size={20} color={colors.navy[700]} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              {createError ? (
                <View style={styles.errorBox}>
                  <AppIcon name="alert-triangle" size={16} color={colors.error} />
                  <Text style={styles.errorBoxText}>{createError}</Text>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Category Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Environmental Rights Violation"
                  placeholderTextColor={colors.navy[400]}
                  value={createName}
                  onChangeText={(val) => {
                    setCreateName(val);
                    if (!createCode || createCode === slugifyCategoryCode(createName)) {
                      setCreateCode(slugifyCategoryCode(val));
                    }
                  }}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  System Code <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.formInput, styles.codeFormInput]}
                  placeholder="e.g. environmental_rights"
                  placeholderTextColor={colors.navy[400]}
                  value={createCode}
                  onChangeText={setCreateCode}
                  autoCapitalize="none"
                />
                <Text style={styles.fieldHelper}>
                  Unique identifier used in database and routing queries.
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Description <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Explain legal parameters or criteria for this incident type..."
                  placeholderTextColor={colors.navy[400]}
                  value={createDescription}
                  onChangeText={setCreateDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reporter Guidance Hint (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Unfair treatment based on who you are"
                  placeholderTextColor={colors.navy[400]}
                  value={createHint}
                  onChangeText={setCreateHint}
                />
                <Text style={styles.fieldHelper}>
                  Displayed to citizens and reporters in the mobile report flow.
                </Text>
              </View>

              {/* Icon Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category Icon</Text>
                <View style={styles.iconChipRow}>
                  {POPULAR_ICONS.map((iconItem) => {
                    const isSelected = createIcon === iconItem.name;
                    return (
                      <Pressable
                        key={iconItem.name}
                        style={[
                          styles.iconChip,
                          isSelected && styles.iconChipSelected,
                        ]}
                        onPress={() => setCreateIcon(iconItem.name)}
                      >
                        <AppIcon
                          name={iconItem.name}
                          size={18}
                          color={isSelected ? colors.royal[700] : colors.navy[600]}
                        />
                        <Text
                          style={[
                            styles.iconChipText,
                            isSelected && styles.iconChipTextSelected,
                          ]}
                        >
                          {iconItem.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Initial Active State */}
              <View style={styles.modalSwitchRow}>
                <View>
                  <Text style={styles.modalSwitchLabel}>Activate Immediately</Text>
                  <Text style={styles.modalSwitchSub}>
                    Make available for case submission upon creation
                  </Text>
                </View>
                <Switch
                  value={createIsActive}
                  onValueChange={setCreateIsActive}
                  trackColor={{ false: colors.navy[200], true: colors.teal[300] }}
                  thumbColor={createIsActive ? colors.teal[700] : colors.navy[400]}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActionRow}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={closeCreateModal}
                  disabled={creating}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSubmitBtn}
                  onPress={() => void handleCreateCategory()}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <>
                      <AppIcon name="plus" size={16} color={colors.textInverse} />
                      <Text style={styles.modalSubmitBtnText}>Create Category</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* EDIT MODAL (JN-381) */}
      <Modal
        visible={Boolean(editingCategory)}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Category</Text>
                <Text style={styles.modalSubtitle}>
                  Update classification properties [code: {editingCategory?.code}]
                </Text>
              </View>
              <Pressable onPress={closeEditModal} disabled={updating}>
                <AppIcon name="x" size={20} color={colors.navy[700]} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              {editError ? (
                <View style={styles.errorBox}>
                  <AppIcon name="alert-triangle" size={16} color={colors.error} />
                  <Text style={styles.errorBoxText}>{editError}</Text>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Category Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Environmental Rights Violation"
                  placeholderTextColor={colors.navy[400]}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Description <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Explain incident parameters..."
                  placeholderTextColor={colors.navy[400]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reporter Guidance Hint (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Guidance shown in reporter submission"
                  placeholderTextColor={colors.navy[400]}
                  value={editHint}
                  onChangeText={setEditHint}
                />
              </View>

              {/* Icon Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category Icon</Text>
                <View style={styles.iconChipRow}>
                  {POPULAR_ICONS.map((iconItem) => {
                    const isSelected = editIcon === iconItem.name;
                    return (
                      <Pressable
                        key={iconItem.name}
                        style={[
                          styles.iconChip,
                          isSelected && styles.iconChipSelected,
                        ]}
                        onPress={() => setEditIcon(iconItem.name)}
                      >
                        <AppIcon
                          name={iconItem.name}
                          size={18}
                          color={isSelected ? colors.royal[700] : colors.navy[600]}
                        />
                        <Text
                          style={[
                            styles.iconChipText,
                            isSelected && styles.iconChipTextSelected,
                          ]}
                        >
                          {iconItem.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalSwitchRow}>
                <View>
                  <Text style={styles.modalSwitchLabel}>Active Status</Text>
                  <Text style={styles.modalSwitchSub}>
                    {editIsActive ? "Available to reporters" : "Hidden from new reports"}
                  </Text>
                </View>
                <Switch
                  value={editIsActive}
                  onValueChange={setEditIsActive}
                  trackColor={{ false: colors.navy[200], true: colors.teal[300] }}
                  thumbColor={editIsActive ? colors.teal[700] : colors.navy[400]}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActionRow}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={closeEditModal}
                  disabled={updating}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSubmitBtn}
                  onPress={() => void handleUpdateCategory()}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <>
                      <AppIcon name="check" size={16} color={colors.textInverse} />
                      <Text style={styles.modalSubmitBtnText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* BLOCKED DELETION MODAL (JN-383 / AC 5) */}
      <Modal
        visible={blockedModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockedModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.blockedCard}>
            <View style={styles.blockedIcon}>
              <AppIcon name="shield-alert" size={32} color={colors.warning} />
            </View>
            <Text style={styles.blockedTitle}>Deletion Protected</Text>
            <Text style={styles.blockedText}>{blockedModal.reason}</Text>

            <View style={styles.blockedActions}>
              <Pressable
                style={styles.blockedDeactivateBtn}
                onPress={() => void handleDeactivateFromBlockedModal()}
              >
                <Text style={styles.blockedDeactivateBtnText}>
                  Deactivate Category Instead
                </Text>
              </Pressable>

              <Pressable
                style={styles.blockedDismissBtn}
                onPress={() => setBlockedModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.blockedDismissBtnText}>Keep Active & Close</Text>
              </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy[200],
    backgroundColor: colors.surface,
    gap: 12,
  },
  headerBackBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.navy[50],
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[900],
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.navy[500],
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.royal[700],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: colors.textInverse,
    fontWeight: "600",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
  },
  kpiCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  kpiCardInactive: {
    borderLeftWidth: 4,
    borderLeftColor: colors.navy[400],
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy[900],
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.navy[600],
    marginTop: 2,
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
    color: colors.navy[900],
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.navy[200],
  },
  activeFilterPill: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[700],
  },
  activeFilterPillText: {
    color: colors.textInverse,
  },
  loadingState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.navy[600],
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.navy[600],
    textAlign: "center",
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 12,
    backgroundColor: colors.navy[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  categoryList: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.navy[200],
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.royal[50],
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: colors.teal[50],
  },
  badgeInactive: {
    backgroundColor: colors.navy[100],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeTextActive: {
    color: colors.teal[700],
  },
  badgeTextInactive: {
    color: colors.navy[600],
  },
  codeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  codeBadge: {
    fontSize: 11,
    fontFamily: "monospace",
    color: colors.navy[600],
    backgroundColor: colors.navy[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  systemBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.royal[700],
    backgroundColor: colors.royal[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  casesCountBadge: {
    fontSize: 11,
    color: colors.navy[500],
  },
  categoryDescription: {
    fontSize: 13,
    color: colors.navy[700],
    lineHeight: 18,
  },
  hintContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.navy[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  hintText: {
    fontSize: 12,
    color: colors.navy[700],
    flex: 1,
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.navy[100],
  },
  switchGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: {
    fontSize: 12,
    color: colors.navy[600],
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.royal[50],
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.royal[700],
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FDECEC",
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: colors.royal[50],
    borderWidth: 1,
    borderColor: colors.royal[200],
    borderRadius: 10,
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  infoBannerContent: {
    flex: 1,
    gap: 2,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.royal[800],
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.royal[700],
    lineHeight: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy[100],
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[900],
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.navy[500],
  },
  modalForm: {
    padding: 16,
    gap: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEC",
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  errorBoxText: {
    fontSize: 13,
    color: colors.error,
    flex: 1,
    fontWeight: "500",
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  requiredStar: {
    color: colors.error,
  },
  formInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.navy[900],
  },
  codeFormInput: {
    fontFamily: "monospace",
  },
  formTextArea: {
    minHeight: 72,
  },
  fieldHelper: {
    fontSize: 11,
    color: colors.navy[500],
  },
  iconChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  iconChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[200],
  },
  iconChipSelected: {
    backgroundColor: colors.royal[50],
    borderColor: colors.royal[700],
  },
  iconChipText: {
    fontSize: 12,
    color: colors.navy[700],
  },
  iconChipTextSelected: {
    color: colors.royal[700],
    fontWeight: "600",
  },
  modalSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  modalSwitchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  modalSwitchSub: {
    fontSize: 11,
    color: colors.navy[500],
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.navy[100],
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.navy[100],
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[700],
  },
  modalSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textInverse,
  },
  // Blocked Deletion Modal Styles
  blockedCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    gap: 12,
  },
  blockedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FDF6E7",
    alignItems: "center",
    justifyContent: "center",
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[900],
  },
  blockedText: {
    fontSize: 13,
    color: colors.navy[700],
    textAlign: "center",
    lineHeight: 18,
  },
  blockedActions: {
    width: "100%",
    gap: 8,
    marginTop: 8,
  },
  blockedDeactivateBtn: {
    backgroundColor: colors.royal[700],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  blockedDeactivateBtnText: {
    color: colors.textInverse,
    fontWeight: "700",
    fontSize: 14,
  },
  blockedDismissBtn: {
    backgroundColor: colors.navy[100],
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  blockedDismissBtnText: {
    color: colors.navy[800],
    fontWeight: "600",
    fontSize: 13,
  },
  // Unauthorized Screen
  unauthorizedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navy[900],
  },
  unauthorizedSubtitle: {
    fontSize: 14,
    color: colors.navy[600],
    textAlign: "center",
    lineHeight: 20,
  },
  backButton: {
    marginTop: 12,
    backgroundColor: colors.royal[700],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.textInverse,
    fontWeight: "600",
    fontSize: 14,
  },
});
