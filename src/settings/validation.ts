import {
  AccountStatusUpdateInput,
  SettingsValidationResult,
  UpdateSystemSettingsInput,
} from "./types";

export const SETTINGS_LIMITS = {
  SESSION_TIMEOUT_MIN: 5,
  SESSION_TIMEOUT_MAX: 120,
  FAILED_LOGIN_ATTEMPTS_MIN: 3,
  FAILED_LOGIN_ATTEMPTS_MAX: 10,
  PASSWORD_MIN_LENGTH_MIN: 6,
  PASSWORD_MIN_LENGTH_MAX: 32,
  RETENTION_YEARS_MIN: 1,
  RETENTION_YEARS_MAX: 20,
  UPLOAD_SIZE_BYTES_MIN: 1048576, // 1 MB
  UPLOAD_SIZE_BYTES_MAX: 524288000, // 500 MB
};

/**
 * Validates system settings updates against allowed operational ranges (JN-395, AC 4).
 */
export function validateSystemSettings(
  input: UpdateSystemSettingsInput,
): SettingsValidationResult {
  const errors: string[] = [];

  // Security Policy Validation
  if (input.security) {
    const { sessionTimeoutMinutes, maxFailedLoginAttempts, passwordMinLength } =
      input.security;

    if (sessionTimeoutMinutes !== undefined) {
      if (
        typeof sessionTimeoutMinutes !== "number" ||
        Number.isNaN(sessionTimeoutMinutes) ||
        sessionTimeoutMinutes < SETTINGS_LIMITS.SESSION_TIMEOUT_MIN ||
        sessionTimeoutMinutes > SETTINGS_LIMITS.SESSION_TIMEOUT_MAX
      ) {
        errors.push(
          `Session timeout must be between ${SETTINGS_LIMITS.SESSION_TIMEOUT_MIN} and ${SETTINGS_LIMITS.SESSION_TIMEOUT_MAX} minutes.`,
        );
      }
    }

    if (maxFailedLoginAttempts !== undefined) {
      if (
        typeof maxFailedLoginAttempts !== "number" ||
        Number.isNaN(maxFailedLoginAttempts) ||
        maxFailedLoginAttempts < SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MIN ||
        maxFailedLoginAttempts > SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MAX
      ) {
        errors.push(
          `Max failed login attempts must be between ${SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MIN} and ${SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MAX}.`,
        );
      }
    }

    if (passwordMinLength !== undefined) {
      if (
        typeof passwordMinLength !== "number" ||
        Number.isNaN(passwordMinLength) ||
        passwordMinLength < SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MIN ||
        passwordMinLength > SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MAX
      ) {
        errors.push(
          `Minimum password length must be between ${SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MIN} and ${SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MAX} characters.`,
        );
      }
    }
  }

  // Evidence Policy Validation
  if (input.evidence) {
    const { retentionPeriodYears, maxUploadSizeBytes } = input.evidence;

    if (retentionPeriodYears !== undefined) {
      if (
        typeof retentionPeriodYears !== "number" ||
        Number.isNaN(retentionPeriodYears) ||
        retentionPeriodYears < SETTINGS_LIMITS.RETENTION_YEARS_MIN ||
        retentionPeriodYears > SETTINGS_LIMITS.RETENTION_YEARS_MAX
      ) {
        errors.push(
          `Retention period must be between ${SETTINGS_LIMITS.RETENTION_YEARS_MIN} and ${SETTINGS_LIMITS.RETENTION_YEARS_MAX} years.`,
        );
      }
    }

    if (maxUploadSizeBytes !== undefined) {
      if (
        typeof maxUploadSizeBytes !== "number" ||
        Number.isNaN(maxUploadSizeBytes) ||
        maxUploadSizeBytes < SETTINGS_LIMITS.UPLOAD_SIZE_BYTES_MIN ||
        maxUploadSizeBytes > SETTINGS_LIMITS.UPLOAD_SIZE_BYTES_MAX
      ) {
        errors.push(
          `Maximum upload size must be between 1 MB and 500 MB (${SETTINGS_LIMITS.UPLOAD_SIZE_BYTES_MIN} - ${SETTINGS_LIMITS.UPLOAD_SIZE_BYTES_MAX} bytes).`,
        );
      }
    }
  }

  // Platform Operational Settings Validation
  if (input.platform) {
    const { maintenanceMode, maintenanceNotice, systemAlertThreshold } =
      input.platform;

    if (maintenanceMode === true) {
      if (
        maintenanceNotice !== undefined &&
        (!maintenanceNotice || maintenanceNotice.trim().length === 0)
      ) {
        errors.push(
          "A maintenance notice description is required when maintenance mode is enabled.",
        );
      }
    }

    if (systemAlertThreshold !== undefined) {
      const validThresholds = ["low", "medium", "high", "critical"];
      if (!validThresholds.includes(systemAlertThreshold)) {
        errors.push(
          `System alert threshold must be one of: ${validThresholds.join(", ")}.`,
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates account status transitions and guards against self-deactivation (AC 1).
 */
export function validateAccountStatusTransition(
  input: AccountStatusUpdateInput,
  actorUserId?: string,
  actorEmail?: string,
): SettingsValidationResult {
  const errors: string[] = [];

  if (!input.targetUserId && !input.targetUserEmail) {
    errors.push("Target user ID or email is required.");
  }

  // Self-deactivation prevention rule
  if (!input.isActive) {
    const isSameId =
      actorUserId &&
      input.targetUserId &&
      actorUserId.trim().toLowerCase() === input.targetUserId.trim().toLowerCase();
    const isSameEmail =
      actorEmail &&
      input.targetUserEmail &&
      actorEmail.trim().toLowerCase() === input.targetUserEmail.trim().toLowerCase();

    if (isSameId || isSameEmail) {
      errors.push(
        "Administrators cannot deactivate their own active administrator account.",
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
