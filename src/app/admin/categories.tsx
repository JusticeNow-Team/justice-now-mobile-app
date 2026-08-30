import { useCallback, useEffect, useState } from "react";
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

import {
  createCategory,
  getCategories,
  ReportCategory,
  toggleCategoryActive,
} from "../../categories";
import { AppIcon, AppIconName, isAppIconName } from "../../components/AppIcon";
import { colors, iconSizes } from "../../theme";

export default function AdminCategoriesScreen() {
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [hint, setHint] = useState("");
  const [icon, setIcon] = useState<AppIconName>("category");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);

      const records = await getCategories({
        activeOnly,
      });

      setCategories(records);
    } catch (error) {
      console.error("Unable to load categories:", error);
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadCategories]);

  const resetForm = () => {
    setName("");
    setCode("");
    setDescription("");
    setHint("");
    setIcon("category");
    setFormError("");
  };

  const closeModal = () => {
    if (creating) {
      return;
    }

    setShowModal(false);
    resetForm();
  };

  const createNewCategory = async () => {
    setFormError("");

    if (!name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    if (!description.trim()) {
      setFormError("Category description is required.");
      return;
    }

    const generatedCode =
      code.trim().toLowerCase() ||
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    try {
      setCreating(true);

      const result = await createCategory({
        name: name.trim(),
        code: generatedCode,
        description: description.trim(),
        hint: hint.trim() || undefined,
        icon: icon || "category",
        isActive: true,
        displayOrder: categories.length + 1,
      });

      if (!result.success) {
        setFormError(result.error || "The category could not be created.");
        return;
      }

      setShowModal(false);
      resetForm();
      await loadCategories();

      Alert.alert("Category created", `${name.trim()} was added successfully.`);
    } catch (error: any) {
      setFormError(error?.message || "The category could not be created.");
    } finally {
      setCreating(false);
    }
  };

  const toggleCategory = async (category: ReportCategory) => {
    const nextValue = !category.isActive;

    const result = await toggleCategoryActive(category.id, nextValue);

    if (!result.success) {
      Alert.alert(
        "Update failed",
        result.error || "The category status could not be updated.",
      );
      return;
    }

    if (activeOnly && !nextValue) {
      setCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
    } else {
      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? {
                ...item,
                isActive: nextValue,
              }
            : item,
        ),
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon name="settings" size={20} color={colors.navy[700]} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>System configuration</Text>
          <Text style={styles.headerSubtitle}>
            Categories and case classifications
          </Text>
        </View>

        <Pressable style={styles.addButton} onPress={() => setShowModal(true)}>
          <AppIcon name="plus" size={16} color={colors.textInverse} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterPill, !activeOnly && styles.activeFilterPill]}
            onPress={() => setActiveOnly(false)}
          >
            <Text
              style={[
                styles.filterPillText,
                !activeOnly && styles.activeFilterPillText,
              ]}
            >
              All categories
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterPill, activeOnly && styles.activeFilterPill]}
            onPress={() => setActiveOnly(true)}
          >
            <Text
              style={[
                styles.filterPillText,
                activeOnly && styles.activeFilterPillText,
              ]}
            >
              Active only
            </Text>
          </Pressable>
        </View>

        <View style={styles.configurationCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupHeaderText}>CASE HANDLING</Text>
          </View>

          <View style={styles.configurationSummary}>
            <View style={styles.summaryIcon}>
              <AppIcon name="category" size={18} color={colors.royal[700]} />
            </View>

            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Case categories</Text>
              <Text style={styles.summaryHint}>
                {categories.filter((category) => category.isActive).length}{" "}
                active categories
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No categories found</Text>
            </View>
          ) : (
            <View style={styles.categoriesList}>
              {categories.map((category, index) => (
                <View
                  key={category.id}
                  style={[
                    styles.categoryRow,
                    index === categories.length - 1 && styles.lastCategoryRow,
                  ]}
                >
                  <View style={styles.categoryIcon}>
                    <AppIcon
                      name={
                        isAppIconName(category.icon ?? "")
                          ? ((category.icon ?? "category") as AppIconName)
                          : "category"
                      }
                      size={20}
                      color={colors.navy[700]}
                    />
                  </View>

                  <View style={styles.categoryInformation}>
                    <View style={styles.categoryNameRow}>
                      <Text style={styles.categoryName}>{category.name}</Text>

                      <View
                        style={[
                          styles.statusBadge,
                          category.isActive
                            ? styles.activeBadge
                            : styles.inactiveBadge,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: category.isActive
                                ? colors.success
                                : colors.textSoft,
                            },
                          ]}
                        />

                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: category.isActive
                                ? colors.success
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.categoryDescription} numberOfLines={2}>
                      {category.description}
                    </Text>

                    <Text style={styles.categoryCode}>{category.code}</Text>
                  </View>

                  <Switch
                    value={category.isActive}
                    onValueChange={() => void toggleCategory(category)}
                    trackColor={{
                      false: colors.border,
                      true: colors.teal[200],
                    }}
                    thumbColor={
                      category.isActive ? colors.teal[600] : colors.textSoft
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.notice}>
          <AppIcon name="warning" size={iconSizes.md} color={colors.warning} />

          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>
              Changes take effect immediately
            </Text>

            <Text style={styles.noticeText}>
              Editing or disabling categories affects new reports. Existing case
              records keep their original category for the audit trail.
            </Text>
          </View>
        </View>
      </ScrollView>

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
                <Text style={styles.modalTitle}>Add report category</Text>
                <Text style={styles.modalSubtitle}>
                  Configure a new case classification
                </Text>
              </View>

              <Pressable onPress={closeModal} disabled={creating}>
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
                label="Category name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Unlawful detention"
              />

              <FormField
                label="Category code"
                value={code}
                onChangeText={setCode}
                placeholder="Generated automatically if empty"
                autoCapitalize="none"
              />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description</Text>

                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  style={styles.textArea}
                  placeholder="Explain when this category should be selected"
                  placeholderTextColor={colors.textSoft}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <FormField
                label="Reporter guidance"
                value={hint}
                onChangeText={setHint}
                placeholder="Optional guidance for reporters"
              />

              <FormField
                label="Icon"
                value={icon}
                onChangeText={(value) => setIcon(isAppIconName(value) ? value : "category")}
                placeholder="category"
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeModal}
                  disabled={creating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.createButton}
                  onPress={() => void createNewCategory()}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <>
                      <AppIcon
                        name="plus"
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

function FormField({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.textSoft}
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
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  addButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
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
    paddingBottom: 28,
    gap: 13,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 20,
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
    fontSize: 13,
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
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupHeaderText: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  configurationSummary: {
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[50],
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  summaryHint: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  loadingState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  categoriesList: {
    paddingHorizontal: 14,
  },
  categoryRow: {
    minHeight: 94,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastCategoryRow: {
    borderBottomWidth: 0,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  categoryInformation: {
    flex: 1,
    minWidth: 0,
  },
  categoryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryName: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  categoryDescription: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  categoryCode: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeBadge: {
    backgroundColor: "#EAF6F0",
  },
  inactiveBadge: {
    backgroundColor: colors.navy[50],
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  notice: {
    padding: 13,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: "#FAEBC8",
    backgroundColor: "#FDF6E7",
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.warning,
  },
  noticeText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,27,46,0.58)",
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
    padding: 17,
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
    padding: 17,
    gap: 13,
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
    fontSize: 13.5,
    color: colors.navy[800],
    outlineStyle: "none",
  } as any,
  textArea: {
    minHeight: 90,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    fontSize: 13.5,
    color: colors.navy[800],
    outlineStyle: "none",
  } as any,
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
  },
  cancelButton: {
    minHeight: 42,
    paddingHorizontal: 17,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.navy[200],
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



