import { INITIAL_REPORT_CATEGORIES } from "./seeds/categoriesSeed";
import {
  CategoryValidationResult,
  CreateCategoryInput,
  DeleteCategoryResult,
  ReportCategory,
} from "./types";

/**
 * Converts a human-readable category name into a valid snake_case code.
 * e.g., "Environmental Rights" -> "environmental_rights"
 */
export function slugifyCategoryCode(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Validates a category creation or update input.
 * Ensures required fields are present and prevents duplicate category names and codes (AC 4).
 */
export function validateCategoryInput(
  input: Partial<CreateCategoryInput>,
  existingCategories: ReportCategory[] = INITIAL_REPORT_CATEGORIES,
  currentId?: string,
): CategoryValidationResult {
  const errors: string[] = [];

  const trimmedName = input.name?.trim() || "";
  const trimmedCode = (input.code?.trim() || slugifyCategoryCode(trimmedName)).toLowerCase();
  const trimmedDescription = input.description?.trim() || "";

  if (!trimmedName) {
    errors.push("Category name is required.");
  } else if (trimmedName.length < 3) {
    errors.push("Category name must be at least 3 characters long.");
  } else if (trimmedName.length > 80) {
    errors.push("Category name must not exceed 80 characters.");
  }

  if (!trimmedCode) {
    errors.push("Category code is required.");
  } else if (!/^[a-z0-9_]+$/.test(trimmedCode)) {
    errors.push(
      "Category code must contain only lowercase letters, numbers, and underscores.",
    );
  } else if (trimmedCode.length > 50) {
    errors.push("Category code must not exceed 50 characters.");
  }

  if (!trimmedDescription) {
    errors.push("Category description is required.");
  } else if (trimmedDescription.length < 5) {
    errors.push("Category description must be at least 5 characters long.");
  }

  // Duplicate Prevention (Acceptance Criteria 4)
  const scopedCategories = existingCategories.filter((c) => c.id !== currentId);

  const isDuplicateName = scopedCategories.some(
    (cat) => cat.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );
  if (isDuplicateName) {
    errors.push(
      `A category with the name "${trimmedName}" already exists. Duplicate category names are not permitted.`,
    );
  }

  const isDuplicateCode = scopedCategories.some(
    (cat) => cat.code.trim().toLowerCase() === trimmedCode.toLowerCase(),
  );
  if (isDuplicateCode) {
    errors.push(
      `A category with the code "${trimmedCode}" already exists. Duplicate category codes are not permitted.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates whether a category can be safely deleted (AC 5 / JN-383).
 * Categories referenced by active or historical cases cannot be unsafely removed.
 */
export function canDeleteCategory(
  category: ReportCategory,
  activeCaseCountOverride?: number,
): DeleteCategoryResult {
  const caseCount =
    activeCaseCountOverride !== undefined
      ? activeCaseCountOverride
      : (category.activeCaseCount ?? 0);

  if (caseCount > 0) {
    return {
      allowed: false,
      activeCaseCount: caseCount,
      reason: `Cannot delete category "${category.name}" because it is currently referenced by ${caseCount} case(s). To preserve historical audit trails and case classifications, please deactivate this category instead.`,
    };
  }

  if (category.isSystemDefault) {
    return {
      allowed: false,
      activeCaseCount: caseCount,
      reason: `System default category "${category.name}" is a core classification and cannot be permanently deleted. You may deactivate it to hide it from new reports.`,
    };
  }

  return {
    allowed: true,
    activeCaseCount: 0,
  };
}

/**
 * Validates category selection in a report draft (Acceptance Criteria 6 & JN-140).
 * Rejects invalid, unknown, or deactivated category selections.
 */
export function validateSelectedCategories(
  selectedIdsOrCodes: string[],
  availableCategories: ReportCategory[] = INITIAL_REPORT_CATEGORIES,
): { isValid: boolean; invalidSelections: string[]; error?: string } {
  if (!selectedIdsOrCodes || selectedIdsOrCodes.length === 0) {
    return {
      isValid: false,
      invalidSelections: [],
      error: "Please select at least one incident category.",
    };
  }

  const activeCategories = availableCategories.filter((c) => c.isActive);
  const activeCodesAndIds = new Set([
    ...activeCategories.map((c) => c.code),
    ...activeCategories.map((c) => c.id),
  ]);

  const invalidSelections: string[] = [];

  for (const selection of selectedIdsOrCodes) {
    if (!activeCodesAndIds.has(selection)) {
      invalidSelections.push(selection);
    }
  }

  if (invalidSelections.length > 0) {
    return {
      isValid: false,
      invalidSelections,
      error: `Invalid or inactive category selection: "${invalidSelections.join(
        ", ",
      )}". Please select valid active categories.`,
    };
  }

  return {
    isValid: true,
    invalidSelections: [],
  };
}
