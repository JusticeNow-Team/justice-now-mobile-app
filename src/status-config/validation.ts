import {
  CreateStatusConfigInput,
  DeleteStatusResult,
  StatusValidationResult,
  WorkflowStatusConfig,
} from "./types";

/**
 * Converts human readable status names into valid snake_case status codes.
 * e.g., "Awaiting Information" -> "awaiting_information"
 */
export function slugifyStatusCode(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Validates status creation and update inputs.
 * Enforces AC 3: Duplicate statuses (code or name) are prevented within the same entity type.
 */
export function validateStatusInput(
  input: Partial<CreateStatusConfigInput>,
  existingStatuses: WorkflowStatusConfig[] = [],
  currentId?: string,
): StatusValidationResult {
  const errors: string[] = [];

  const name = input.name?.trim() || "";
  const code = (input.code?.trim() || slugifyStatusCode(name)).toLowerCase();
  const description = input.description?.trim() || "";
  const entityType = input.entityType || "case";

  if (!name) {
    errors.push("Status display name is required.");
  } else if (name.length < 2) {
    errors.push("Status display name must be at least 2 characters long.");
  } else if (name.length > 50) {
    errors.push("Status display name must not exceed 50 characters.");
  }

  if (!code) {
    errors.push("Status code is required.");
  } else if (!/^[a-z0-9_]+$/.test(code)) {
    errors.push(
      "Status code must contain only lowercase letters, numbers, and underscores.",
    );
  } else if (code.length > 50) {
    errors.push("Status code must not exceed 50 characters.");
  }

  if (!description) {
    errors.push("Status description is required.");
  } else if (description.length < 5) {
    errors.push("Status description must be at least 5 characters long.");
  }

  // Duplicate prevention within same entityType (AC 3)
  const scopedStatuses = existingStatuses.filter(
    (s) => s.entityType === entityType && s.id !== currentId,
  );

  const duplicateCode = scopedStatuses.find(
    (s) => s.code.toLowerCase() === code.toLowerCase(),
  );
  if (duplicateCode) {
    errors.push(
      `A ${entityType} status with code "${code}" already exists ("${duplicateCode.name}").`,
    );
  }

  const duplicateName = scopedStatuses.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicateName) {
    errors.push(
      `A ${entityType} status with name "${name}" already exists.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates whether a status can be safely deleted.
 * Enforces AC 4: Statuses used by active records cannot be deleted unsafely.
 */
export function canDeleteStatus(
  status: WorkflowStatusConfig,
  activeRecordCountOverride?: number,
): DeleteStatusResult {
  const count =
    activeRecordCountOverride !== undefined
      ? activeRecordCountOverride
      : status.activeRecordCount || 0;

  if (status.isSystemDefault) {
    return {
      allowed: false,
      reason: `Cannot delete "${status.name}": Core system default statuses cannot be deleted. You can deactivate it instead.`,
      activeRecordCount: count,
    };
  }

  if (count > 0) {
    const recordLabel =
      status.entityType === "case" ? "active cases" : "evidence items";
    return {
      allowed: false,
      reason: `Cannot delete "${status.name}": It is currently assigned to ${count} ${recordLabel}. Deactivate the status instead so historical data remains traceable.`,
      activeRecordCount: count,
    };
  }

  return {
    allowed: true,
    activeRecordCount: 0,
  };
}
