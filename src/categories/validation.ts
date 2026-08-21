import { INITIAL_REPORT_CATEGORIES } from "./seeds/categoriesSeed";
import {
  CategoryValidationResult,
  CreateCategoryInput,
  ReportCategory,
} from "./types";

/**
 * Validates a new category creation input.
 * Ensures required fields are present and prevents duplicate category names and codes.
 */
export function validateCategoryInput(
  input: CreateCategoryInput,
  existingCategories: ReportCategory[] = INITIAL_REPORT_CATEGORIES
): CategoryValidationResult {
  const errors: string[] = [];

  const trimmedName = input.name?.trim() || "";
  const trimmedCode = input.code?.trim() || "";
  const trimmedDescription = input.description?.trim() || "";

  if (!trimmedName) {
    errors.push("Category name is required.");
  } else if (trimmedName.length < 3) {
    errors.push("Category name must be at least 3 characters long.");
  }

  if (!trimmedCode) {
    errors.push("Category code is required.");
  } else if (!/^[a-z0-9_]+$/.test(trimmedCode)) {
    errors.push(
      "Category code must contain only lowercase letters, numbers, and underscores."
    );
  }

  if (!trimmedDescription) {
    errors.push("Category description is required.");
  }

  // Duplicate Prevention (Acceptance Criteria 4)
  const isDuplicateName = existingCategories.some(
    (cat) => cat.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicateName) {
    errors.push(
      `A category with the name "${trimmedName}" already exists. Duplicate category names are not permitted.`
    );
  }

  const isDuplicateCode = existingCategories.some(
    (cat) => cat.code.trim().toLowerCase() === trimmedCode.toLowerCase()
  );
  if (isDuplicateCode) {
    errors.push(
      `A category with the code "${trimmedCode}" already exists. Duplicate category codes are not permitted.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates category selection in a report draft (Acceptance Criteria 7).
 * Rejects invalid, unknown, or deactivated category selections.
 */
export function validateSelectedCategories(
  selectedIdsOrCodes: string[],
  availableCategories: ReportCategory[] = INITIAL_REPORT_CATEGORIES
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
        ", "
      )}". Please select valid active categories.`,
    };
  }

  return {
    isValid: true,
    invalidSelections: [],
  };
}
