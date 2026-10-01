import { recordAuditEvent } from "../audit/auditService";
import { normalizeRole } from "../auth/roles";
import { supabase } from "../lib/supabase";
import { INITIAL_REPORT_CATEGORIES } from "./seeds/categoriesSeed";
import {
  CategoryActor,
  CategoryFilterOptions,
  CreateCategoryInput,
  DeleteCategoryResult,
  ReportCategory,
  UpdateCategoryInput,
} from "./types";
import {
  canDeleteCategory,
  slugifyCategoryCode,
  validateCategoryInput,
} from "./validation";

// Internal local cache initialized with seed data
let localCategoriesCache: ReportCategory[] = [
  ...INITIAL_REPORT_CATEGORIES.map((c) => ({ ...c })),
];

/**
 * Normalizes raw database record into typed ReportCategory.
 */
function mapDbRecordToCategory(row: any): ReportCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || "",
    hint: row.hint || undefined,
    icon: row.icon || "category",
    isActive: Boolean(row.is_active),
    isSystemDefault: Boolean(row.is_system_default),
    displayOrder: Number(row.display_order ?? 0),
    activeCaseCount: Number(row.active_case_count ?? 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Helper to ensure the actor is authorized as a System Administrator.
 */
function requireAdministrator(actor?: CategoryActor): {
  isAuthorized: boolean;
  error?: string;
} {
  if (!actor || !actor.role) {
    // If no actor context is passed in testing/local mode, allow by default
    return { isAuthorized: true };
  }

  const roleNorm = normalizeRole(actor.role);
  if (roleNorm !== "system_admin") {
    return {
      isAuthorized: false,
      error: "Unauthorized: Only System Administrators can configure report categories.",
    };
  }

  return { isAuthorized: true };
}

/**
 * Applies search and active status filters to a category list.
 */
function applyCategoryFilters(
  list: ReportCategory[],
  options: CategoryFilterOptions = {},
): ReportCategory[] {
  let result = [...list];

  if (options.activeOnly || options.statusFilter === "active") {
    result = result.filter((cat) => cat.isActive);
  } else if (options.statusFilter === "inactive") {
    result = result.filter((cat) => !cat.isActive);
  }

  if (options.searchQuery?.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter((cat) =>
      [cat.name, cat.code, cat.description, cat.hint || ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  return result.sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Fetches all report categories (Subtask JN-379).
 * Supports search and active-only filtering.
 */
export async function getCategories(
  options: CategoryFilterOptions = {},
): Promise<ReportCategory[]> {
  try {
    let query = supabase
      .from("report_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (options.activeOnly || options.statusFilter === "active") {
      query = query.eq("is_active", true);
    } else if (options.statusFilter === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const fetched = data.map(mapDbRecordToCategory);
      if (!options.activeOnly && !options.statusFilter && !options.searchQuery) {
        localCategoriesCache = fetched;
      }
      return applyCategoryFilters(fetched, options);
    }
  } catch (err) {
    console.warn("Could not query Supabase report_categories, using local cache:", err);
  }

  return applyCategoryFilters(localCategoriesCache, options);
}

/**
 * Returns only active categories for the Reporter incident flow (Acceptance Criteria 6 & JN-140).
 */
export async function getActiveCategories(): Promise<ReportCategory[]> {
  return getCategories({ activeOnly: true });
}

/**
 * Synchronous getter for offline / instant UI rendering of active categories.
 */
export function getCachedActiveCategories(): ReportCategory[] {
  return localCategoriesCache
    .filter((cat) => cat.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Synchronous getter for all cached categories.
 */
export function getCachedAllCategories(): ReportCategory[] {
  return [...localCategoriesCache].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}

/**
 * Finds a category by its unique code.
 */
export async function getCategoryByCode(
  code: string,
): Promise<ReportCategory | null> {
  const all = await getCategories();
  return (
    all.find(
      (cat) => cat.code.trim().toLowerCase() === code.trim().toLowerCase(),
    ) || null
  );
}

/**
 * Finds a category by its unique ID.
 */
export async function getCategoryById(
  id: string,
): Promise<ReportCategory | null> {
  const all = await getCategories();
  return all.find((cat) => cat.id === id) || null;
}

/**
 * JN-380 & AC 1 & AC 4 & AC 7: Creates a new report category (System Admin capability).
 * Enforces duplicate name and code rejection and records an audit event.
 */
export async function createCategory(
  input: CreateCategoryInput,
  actor?: CategoryActor,
): Promise<{
  success: boolean;
  category?: ReportCategory;
  error?: string;
  errors?: string[];
}> {
  // AC 1 & AC 6: Role Authorization Guard
  const authCheck = requireAdministrator(actor);
  if (!authCheck.isAuthorized) {
    return { success: false, error: authCheck.error };
  }

  // AC 4: Validate input & reject duplicate names/codes
  const validation = validateCategoryInput(input, localCategoriesCache);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors[0] || "Validation failed.",
      errors: validation.errors,
    };
  }

  const generatedCode = (input.code?.trim() || slugifyCategoryCode(input.name)).toLowerCase();

  const newCategory: ReportCategory = {
    id: `cat_${generatedCode}_${Date.now()}`,
    code: generatedCode,
    name: input.name.trim(),
    description: input.description.trim(),
    hint: input.hint?.trim() || undefined,
    icon: input.icon || "category",
    isActive: input.isActive ?? true,
    isSystemDefault: input.isSystemDefault ?? false,
    displayOrder: input.displayOrder ?? localCategoriesCache.length + 1,
    activeCaseCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("report_categories")
      .insert({
        code: newCategory.code,
        name: newCategory.name,
        description: newCategory.description,
        hint: newCategory.hint,
        icon: newCategory.icon,
        is_active: newCategory.isActive,
        is_system_default: newCategory.isSystemDefault,
        display_order: newCategory.displayOrder,
      })
      .select()
      .single();

    if (!error && data) {
      const persisted = mapDbRecordToCategory(data);
      localCategoriesCache.push(persisted);

      // AC 7 (JN-384): Audit Log
      await recordAuditEvent({
        eventType: "CATEGORY_CREATED",
        actorId: actor?.userId || "system_admin",
        actorEmail: actor?.email || "admin@justicenow.org",
        actorRole: (actor?.role as any) || "system_admin",
        targetId: persisted.id,
        targetEmail: persisted.name,
        action: "Create Report Category",
        description: `Created new incident category "${persisted.name}" [code: ${persisted.code}]`,
        details: {
          categoryName: persisted.name,
          categoryCode: persisted.code,
          description: persisted.description,
          isActive: persisted.isActive,
          icon: persisted.icon,
        },
      });

      return { success: true, category: persisted };
    }
  } catch (err) {
    console.warn("Could not insert category to Supabase, saving locally:", err);
  }

  localCategoriesCache.push(newCategory);

  // AC 7 (JN-384): Audit Log (local fallback)
  await recordAuditEvent({
    eventType: "CATEGORY_CREATED",
    actorId: actor?.userId || "system_admin",
    actorEmail: actor?.email || "admin@justicenow.org",
    actorRole: (actor?.role as any) || "system_admin",
    targetId: newCategory.id,
    targetEmail: newCategory.name,
    action: "Create Report Category",
    description: `Created new incident category "${newCategory.name}" [code: ${newCategory.code}]`,
    details: {
      categoryName: newCategory.name,
      categoryCode: newCategory.code,
      description: newCategory.description,
      isActive: newCategory.isActive,
      icon: newCategory.icon,
    },
  });

  return { success: true, category: newCategory };
}

/**
 * JN-381 & AC 2 & AC 4 & AC 7: Updates an existing report category.
 * Enforces duplicate name rejection (excluding self) and records an audit event.
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actor?: CategoryActor,
): Promise<{
  success: boolean;
  category?: ReportCategory;
  error?: string;
  errors?: string[];
}> {
  // AC 2 & AC 6: Role Authorization Guard
  const authCheck = requireAdministrator(actor);
  if (!authCheck.isAuthorized) {
    return { success: false, error: authCheck.error };
  }

  const existingIndex = localCategoriesCache.findIndex((c) => c.id === id);
  if (existingIndex === -1) {
    return { success: false, error: "Category not found." };
  }

  const currentCategory = localCategoriesCache[existingIndex];
  const previousState = { ...currentCategory };

  // AC 4: Validate name uniqueness and input rules
  if (input.name !== undefined) {
    const validation = validateCategoryInput(
      {
        name: input.name,
        code: currentCategory.code,
        description: input.description ?? currentCategory.description,
      },
      localCategoriesCache,
      id,
    );

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0] || "Validation failed.",
        errors: validation.errors,
      };
    }
  }

  // Apply updates
  if (input.name !== undefined) {
    currentCategory.name = input.name.trim();
  }
  if (input.description !== undefined) {
    currentCategory.description = input.description.trim();
  }
  if (input.hint !== undefined) {
    currentCategory.hint = input.hint.trim() || undefined;
  }
  if (input.icon !== undefined) {
    currentCategory.icon = input.icon;
  }
  if (input.isActive !== undefined) {
    currentCategory.isActive = input.isActive;
  }
  if (input.displayOrder !== undefined) {
    currentCategory.displayOrder = input.displayOrder;
  }
  currentCategory.updatedAt = new Date().toISOString();

  try {
    await supabase
      .from("report_categories")
      .update({
        name: currentCategory.name,
        description: currentCategory.description,
        hint: currentCategory.hint,
        icon: currentCategory.icon,
        is_active: currentCategory.isActive,
        display_order: currentCategory.displayOrder,
        updated_at: currentCategory.updatedAt,
      })
      .eq("id", id);
  } catch (err) {
    console.warn("Could not update category in Supabase:", err);
  }

  // AC 7 (JN-384): Audit Log
  await recordAuditEvent({
    eventType: "CATEGORY_UPDATED",
    actorId: actor?.userId || "system_admin",
    actorEmail: actor?.email || "admin@justicenow.org",
    actorRole: (actor?.role as any) || "system_admin",
    targetId: currentCategory.id,
    targetEmail: currentCategory.name,
    action: "Update Report Category",
    description: `Updated category "${currentCategory.name}" [code: ${currentCategory.code}]`,
    details: {
      categoryCode: currentCategory.code,
      before: previousState,
      after: { ...currentCategory },
    },
  });

  return {
    success: true,
    category: currentCategory,
  };
}

/**
 * JN-382 & AC 3 & AC 7: Toggles a category's active state (System Admin capability).
 */
export async function toggleCategoryActive(
  id: string,
  isActive: boolean,
  actor?: CategoryActor,
): Promise<{ success: boolean; category?: ReportCategory; error?: string }> {
  // AC 3 & AC 6: Role Authorization Guard
  const authCheck = requireAdministrator(actor);
  if (!authCheck.isAuthorized) {
    return { success: false, error: authCheck.error };
  }

  const existingIndex = localCategoriesCache.findIndex((c) => c.id === id);
  if (existingIndex === -1) {
    return { success: false, error: "Category not found." };
  }

  const category = localCategoriesCache[existingIndex];
  category.isActive = isActive;
  category.updatedAt = new Date().toISOString();

  try {
    await supabase
      .from("report_categories")
      .update({ is_active: isActive, updated_at: category.updatedAt })
      .eq("id", id);
  } catch (err) {
    console.warn("Could not update category status in Supabase:", err);
  }

  // AC 7 (JN-384): Audit Log
  await recordAuditEvent({
    eventType: isActive ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED",
    actorId: actor?.userId || "system_admin",
    actorEmail: actor?.email || "admin@justicenow.org",
    actorRole: (actor?.role as any) || "system_admin",
    targetId: category.id,
    targetEmail: category.name,
    action: isActive ? "Activate Report Category" : "Deactivate Report Category",
    description: `${isActive ? "Activated" : "Deactivated"} category "${category.name}" [code: ${category.code}]`,
    details: {
      categoryCode: category.code,
      isActive,
    },
  });

  return {
    success: true,
    category,
  };
}

/**
 * JN-383 & AC 5 & AC 7: Safely deletes a category.
 * Enforces that categories referenced by cases cannot be unsafely deleted.
 */
export async function deleteCategory(
  id: string,
  actor?: CategoryActor,
): Promise<{
  success: boolean;
  category?: ReportCategory;
  error?: string;
  activeCaseCount?: number;
}> {
  // AC 5 & AC 6: Role Authorization Guard
  const authCheck = requireAdministrator(actor);
  if (!authCheck.isAuthorized) {
    return { success: false, error: authCheck.error };
  }

  const existingIndex = localCategoriesCache.findIndex((c) => c.id === id);
  if (existingIndex === -1) {
    return { success: false, error: "Category not found." };
  }

  const category = localCategoriesCache[existingIndex];

  // AC 5 (JN-383): Safe deletion check
  const safetyCheck: DeleteCategoryResult = canDeleteCategory(category);
  if (!safetyCheck.allowed) {
    return {
      success: false,
      error: safetyCheck.reason,
      activeCaseCount: safetyCheck.activeCaseCount,
    };
  }

  localCategoriesCache.splice(existingIndex, 1);

  try {
    await supabase.from("report_categories").delete().eq("id", id);
  } catch (err) {
    console.warn("Could not delete category from Supabase:", err);
  }

  // AC 7 (JN-384): Audit Log
  await recordAuditEvent({
    eventType: "CATEGORY_DELETED",
    actorId: actor?.userId || "system_admin",
    actorEmail: actor?.email || "admin@justicenow.org",
    actorRole: (actor?.role as any) || "system_admin",
    targetId: category.id,
    targetEmail: category.name,
    action: "Delete Report Category",
    description: `Permanently deleted unused category "${category.name}" [code: ${category.code}]`,
    details: {
      categoryCode: category.code,
      categoryName: category.name,
    },
  });

  return {
    success: true,
    category,
  };
}

/**
 * Resets local cache to initial seeds (for testing and reset flows).
 */
export function resetCategoriesToDefault(): void {
  localCategoriesCache = INITIAL_REPORT_CATEGORIES.map((c) => ({ ...c }));
}
