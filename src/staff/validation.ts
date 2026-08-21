import { SystemRole } from "../auth/types";
import { CreateStaffInput, StaffAccount, StaffValidationResult } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_STAFF_ROLES: readonly SystemRole[] = [
  "case_officer",
  "evidence_checker",
  "system_admin",
  "reporter",
];

/**
 * Validates the input payload for creating or editing a staff account.
 */
export function validateStaffInput(input: CreateStaffInput): StaffValidationResult {
  const errors: string[] = [];

  const cleanName = input.fullName ? input.fullName.trim() : "";
  const cleanEmail = input.email ? input.email.trim().toLowerCase() : "";

  if (!cleanName) {
    errors.push("Full name is required.");
  } else if (cleanName.length < 2) {
    errors.push("Full name must be at least 2 characters.");
  }

  if (!cleanEmail) {
    errors.push("Staff email address is required.");
  } else if (!EMAIL_REGEX.test(cleanEmail)) {
    errors.push("Please enter a valid email address.");
  }

  if (!input.role) {
    errors.push("Staff role must be selected.");
  } else if (!ALLOWED_STAFF_ROLES.includes(input.role)) {
    errors.push(`Role must be one of: ${ALLOWED_STAFF_ROLES.join(", ")}.`);
  }

  if (input.password !== undefined && input.password.length > 0) {
    if (input.password.length < 6) {
      errors.push("Password must be at least 6 characters.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a given email is already registered to another staff account (case-insensitive).
 */
export function checkDuplicateStaffEmail(
  email: string,
  existingStaff: StaffAccount[],
  currentStaffId?: string
): { isDuplicate: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();

  const match = existingStaff.find(
    (s) => s.email.trim().toLowerCase() === cleanEmail && s.id !== currentStaffId
  );

  if (match) {
    return {
      isDuplicate: true,
      error: `Email "${cleanEmail}" is already registered to ${match.fullName} (${match.role}). Duplicate emails are prevented.`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Checks whether an administrator is allowed to deactivate a given staff account.
 * Prevents admins from deactivating their own active account to avoid lockout.
 */
export function canDeactivateStaff(
  targetStaff: StaffAccount,
  currentAdminId?: string
): { allowed: boolean; reason?: string } {
  if (currentAdminId && targetStaff.id === currentAdminId) {
    return {
      allowed: false,
      reason: "You cannot deactivate your own administrator account while logged in.",
    };
  }

  return { allowed: true };
}
