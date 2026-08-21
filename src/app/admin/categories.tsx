import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { RoleGuard } from "../../auth";
import {
  createCategory,
  getCategories,
  ReportCategory,
  toggleCategoryActive,
} from "../../categories";
import { colors } from "../../theme";

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newHint, setNewHint] = useState("");
  const [newIcon, setNewIcon] = useState("📋");
  const [newIsActive, setNewIsActive] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadCategoriesData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCategories({ activeOnly: filterActiveOnly });
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  }, [filterActiveOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCategoriesData();
  }, [loadCategoriesData]);

  const handleToggle = async (cat: ReportCategory) => {
    const nextState = !cat.isActive;
    const result = await toggleCategoryActive(cat.id, nextState);
    if (result.success) {
      setCategories((prev) =>
        prev.map((item) =>
          item.id === cat.id ? { ...item, isActive: nextState } : item
        )
      );
    } else {
      Alert.alert("Action Failed", result.error || "Could not update category status.");
    }
  };

  const handleCreateCategory = async () => {
    setModalError("");

    if (!newName.trim()) {
      setModalError("Category name is required.");
      return;
    }

    const autoCode =
      newCode.trim().toLowerCase() ||
      newName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (!autoCode) {
      setModalError("Category code is required.");
      return;
    }

    if (!newDescription.trim()) {
      setModalError("Category description is required.");
      return;
    }

    try {
      setModalLoading(true);
      const res = await createCategory({
        name: newName.trim(),
        code: autoCode,
        description: newDescription.trim(),
        hint: newHint.trim() || undefined,
        icon: newIcon.trim() || "📋",
        isActive: newIsActive,
      });

      if (!res.success) {
        setModalError(res.error || "Could not create category.");
        return;
      }

      setShowAddModal(false);
      setNewName("");
      setNewCode("");
      setNewDescription("");
      setNewHint("");
      setNewIcon("📋");
      setNewIsActive(true);
      await loadCategoriesData();
      Alert.alert("Success", `Category "${newName}" has been created.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create category.";
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["system_admin"]}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Report Categories</Text>
            <Text style={styles.headerSubtitle}>
              JN-135 Category Management & Active Filters
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setModalError("");
              setShowAddModal(true);
            }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {/* Filter bar */}
        <View style={styles.filterBar}>
          <Pressable
            style={[
              styles.filterPill,
              !filterActiveOnly && styles.filterPillActive,
            ]}
            onPress={() => setFilterActiveOnly(false)}
          >
            <Text
              style={[
                styles.filterPillText,
                !filterActiveOnly && styles.filterPillTextActive,
              ]}
            >
              All Categories ({categories.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              filterActiveOnly && styles.filterPillActive,
            ]}
            onPress={() => setFilterActiveOnly(true)}
          >
            <Text
              style={[
                styles.filterPillText,
                filterActiveOnly && styles.filterPillTextActive,
              ]}
            >
              Active Only
            </Text>
          </Pressable>
        </View>

        {/* Category List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.royal[600]} />
              <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No categories found</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.categoryIcon}>{cat.icon || "📋"}</Text>
                    </View>
                    <View style={styles.categoryInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            cat.isActive
                              ? styles.activeBadge
                              : styles.inactiveBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              cat.isActive
                                ? styles.activeBadgeText
                                : styles.inactiveBadgeText,
                            ]}
                          >
                            {cat.isActive ? "ACTIVE" : "INACTIVE"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.categoryCode}>code: {cat.code}</Text>
                    </View>
                  </View>

                  <Text style={styles.categoryDescription}>
                    {cat.description}
                  </Text>
                  {cat.hint ? (
                    <Text style={styles.categoryHint}>Hint: {cat.hint}</Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.toggleLabel}>
                      {cat.isActive
                        ? "Visible in Reporter form"
                        : "Hidden from Reporter form"}
                    </Text>
                    <Switch
                      value={cat.isActive}
                      onValueChange={() => handleToggle(cat)}
                      trackColor={{
                        false: colors.navy[200],
                        true: colors.royal[400],
                      }}
                      thumbColor={
                        cat.isActive ? colors.royal[700] : colors.navy[400]
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Add Category Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Report Category</Text>
                <Pressable
                  onPress={() => setShowAddModal(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalForm}
              >
                {modalError ? (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorText}>{modalError}</Text>
                  </View>
                ) : null}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Category Name *</Text>
                  <TextInput
                    value={newName}
                    onChangeText={(val) => {
                      setNewName(val);
                      if (!newCode) {
                        setNewCode(
                          val
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "_")
                            .replace(/^_+|_+$/g, "")
                        );
                      }
                    }}
                    placeholder="e.g. Environmental Rights"
                    placeholderTextColor={colors.textSoft}
                    style={styles.textInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Code Identifier * (Must be unique)
                  </Text>
                  <TextInput
                    value={newCode}
                    onChangeText={setNewCode}
                    placeholder="e.g. environmental_rights"
                    placeholderTextColor={colors.textSoft}
                    autoCapitalize="none"
                    style={styles.textInput}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Icon Emoji</Text>
                  <TextInput
                    value={newIcon}
                    onChangeText={setNewIcon}
                    placeholder="e.g. 🌿"
                    placeholderTextColor={colors.textSoft}
                    style={[styles.textInput, { width: 80 }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description *</Text>
                  <TextInput
                    value={newDescription}
                    onChangeText={setNewDescription}
                    placeholder="Full explanation of rights covered..."
                    placeholderTextColor={colors.textSoft}
                    multiline
                    numberOfLines={3}
                    style={[styles.textInput, styles.textArea]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Reporter Hint</Text>
                  <TextInput
                    value={newHint}
                    onChangeText={setNewHint}
                    placeholder="Short summary displayed to reporters..."
                    placeholderTextColor={colors.textSoft}
                    style={styles.textInput}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.formLabel}>Active & Visible Now</Text>
                  <Switch
                    value={newIsActive}
                    onValueChange={setNewIsActive}
                    trackColor={{
                      false: colors.navy[200],
                      true: colors.royal[400],
                    }}
                    thumbColor={
                      newIsActive ? colors.royal[700] : colors.navy[400]
                    }
                  />
                </View>

                <Pressable
                  onPress={handleCreateCategory}
                  disabled={modalLoading}
                  style={[
                    styles.createButton,
                    modalLoading && styles.disabledButton,
                  ]}
                >
                  {modalLoading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={styles.createButtonText}>Save Category</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 30,
    color: colors.navy[700],
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
  filterBar: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.navy[200],
  },
  filterPillActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy[800],
  },
  cardList: {
    gap: 12,
  },
  categoryCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.royal[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },
  categoryCode: {
    fontSize: 11.5,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadge: {
    backgroundColor: "#E6F4EA",
  },
  inactiveBadge: {
    backgroundColor: "#FCE8E6",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  activeBadgeText: {
    color: "#137333",
  },
  inactiveBadgeText: {
    color: "#C5221F",
  },
  categoryDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.navy[800],
    marginBottom: 6,
  },
  categoryHint: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textSecondary,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggleLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  modalForm: {
    padding: 16,
    gap: 14,
  },
  modalErrorBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#FCE8E6",
    borderWidth: 1,
    borderColor: "#F5C2C7",
  },
  modalErrorText: {
    fontSize: 12,
    color: "#C5221F",
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  textInput: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 10,
    fontSize: 13.5,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 70,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  createButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.royal[700],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
