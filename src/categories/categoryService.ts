import { supabase } from "../lib/supabase";
import { INITIAL_REPORT_CATEGORIES } from "./seeds/categoriesSeed";
import {
  CreateCategoryInput,
  ReportCategory,
  UpdateCategoryInput,
} from "./types";
import { validateCategoryInput } from "./validation";

// Internal local cache initialized with seeds
let localCategoriesCache: ReportCategory[] = [
  ...INITIAL_REPORT_CATEGORIES.map((c) => ({ ...c })),
];

/**
 * Normalizes raw database record into typed ReportCategory.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRecordToCategory(row: any): ReportCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    hint: row.hint || undefined,
    icon: row.icon || "📋",
    isActive: Boolean(row.is_active),
    displayOrder: Number(row.display_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all report categories (Subtask JN-138).
 * Supports active-only filtering (Subtask JN-140).
 */
export async function getCategories(options?: {
  activeOnly?: boolean;
}): Promise<ReportCategory[]> {
  try {
    let query = supabase
      .from("report_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const fetched = data.map(mapDbRecordToCategory);
      if (!options?.activeOnly) {
        localCategoriesCache = fetched;
      }
      return fetched;
    }
  } catch (err) {
    console.warn("Could not query Supabase report_categories, using cache:", err);
  }

  // Fallback to local cache
  if (options?.activeOnly) {
    return localCategoriesCache
      .filter((cat) => cat.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  return [...localCategoriesCache].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

/**
 * Returns only active categories for the Reporter form (Acceptance Criteria 3 & JN-140).
 */
export async function getActiveCategories(): Promise<ReportCategory[]> {
  return getCategories({ activeOnly: true });
}

/**
 * Synchronous getter for offline/instant UI rendering.
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
    (a, b) => a.displayOrder - b.displayOrder
  );
}

/**
 * Finds a category by its unique code.
 */
export async function getCategoryByCode(
  code: string
): Promise<ReportCategory | null> {
  const all = await getCategories();
  return (
    all.find(
      (cat) => cat.code.trim().toLowerCase() === code.trim().toLowerCase()
    ) || null
  );
}

/**
 * Finds a category by its ID.
 */
export async function getCategoryById(
  id: string
): Promise<ReportCategory | null> {
  const all = await getCategories();
  return all.find((cat) => cat.id === id) || null;
}

/**
 * Creates a new report category (System Admin capability).
 * Enforces duplicate name and code prevention (Acceptance Criteria 4).
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<{ success: boolean; category?: ReportCategory; error?: string }> {
  // Validate input & check duplicate names/codes
  const validation = validateCategoryInput(input, localCategoriesCache);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join(" "),
    };
  }

  const newCategory: ReportCategory = {
    id: `cat_${input.code}_${Date.now()}`,
    code: input.code.trim().toLowerCase(),
    name: input.name.trim(),
    description: input.description.trim(),
    hint: input.hint?.trim() || undefined,
    icon: input.icon || "📋",
    isActive: input.isActive ?? true,
    displayOrder: input.displayOrder ?? localCategoriesCache.length + 1,
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
        display_order: newCategory.displayOrder,
      })
      .select()
      .single();

    if (!error && data) {
      const persisted = mapDbRecordToCategory(data);
      localCategoriesCache.push(persisted);
      return { success: true, category: persisted };
    }
  } catch (err) {
    console.warn("Could not insert category to Supabase, saving locally:", err);
  }

  localCategoriesCache.push(newCategory);
  return { success: true, category: newCategory };
}

/**
 * Toggles a category's active state (System Admin capability).
 */
export async function toggleCategoryActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; category?: ReportCategory; error?: string }> {
  const existingIndex = localCategoriesCache.findIndex((c) => c.id === id);
  if (existingIndex === -1) {
    return { success: false, error: "Category not found." };
  }

  localCategoriesCache[existingIndex].isActive = isActive;
  localCategoriesCache[existingIndex].updatedAt = new Date().toISOString();

  try {
    await supabase
      .from("report_categories")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id);
  } catch (err) {
    console.warn("Could not update category in Supabase:", err);
  }

  return {
    success: true,
    category: localCategoriesCache[existingIndex],
  };
}

/**
 * Updates an existing category's properties.
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<{ success: boolean; category?: ReportCategory; error?: string }> {
  const existingIndex = localCategoriesCache.findIndex((c) => c.id === id);
  if (existingIndex === -1) {
    return { success: false, error: "Category not found." };
  }

  // Duplicate name check if name changed
  if (input.name && input.name.trim()) {
    const trimmedNewName = input.name.trim().toLowerCase();
    const isDuplicate = localCategoriesCache.some(
      (c) => c.id !== id && c.name.trim().toLowerCase() === trimmedNewName
    );
    if (isDuplicate) {
      return {
        success: false,
        error: `A category named "${input.name.trim()}" already exists.`,
      };
    }
    localCategoriesCache[existingIndex].name = input.name.trim();
  }

  if (input.description !== undefined) {
    localCategoriesCache[existingIndex].description = input.description.trim();
  }
  if (input.hint !== undefined) {
    localCategoriesCache[existingIndex].hint = input.hint.trim() || undefined;
  }
  if (input.icon !== undefined) {
    localCategoriesCache[existingIndex].icon = input.icon;
  }
  if (input.isActive !== undefined) {
    localCategoriesCache[existingIndex].isActive = input.isActive;
  }
  if (input.displayOrder !== undefined) {
    localCategoriesCache[existingIndex].displayOrder = input.displayOrder;
  }

  localCategoriesCache[existingIndex].updatedAt = new Date().toISOString();

  try {
    await supabase
      .from("report_categories")
      .update({
        name: localCategoriesCache[existingIndex].name,
        description: localCategoriesCache[existingIndex].description,
        hint: localCategoriesCache[existingIndex].hint,
        icon: localCategoriesCache[existingIndex].icon,
        is_active: localCategoriesCache[existingIndex].isActive,
        display_order: localCategoriesCache[existingIndex].displayOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    console.warn("Could not update category in Supabase:", err);
  }

  return {
    success: true,
    category: localCategoriesCache[existingIndex],
  };
}

/**
 * Resets local cache to initial seeds (for testing).
 */
export function resetCategoriesToDefault(): void {
  localCategoriesCache = INITIAL_REPORT_CATEGORIES.map((c) => ({ ...c }));
}
