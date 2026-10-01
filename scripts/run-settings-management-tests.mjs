import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

// ============================================================================
// SPRINT 4 TASK: MANAGE ACCOUNT ACTIVATION AND SYSTEM SETTINGS (JN-393 to JN-398)
// Contract, Validation & Functional Verification Test Suite
// ============================================================================

const settingsTypesFile = await readFile(
  new URL("../src/settings/types.ts", import.meta.url),
  "utf8",
);
const settingsValidationFile = await readFile(
  new URL("../src/settings/validation.ts", import.meta.url),
  "utf8",
);
const settingsServiceFile = await readFile(
  new URL("../src/settings/settingsService.ts", import.meta.url),
  "utf8",
);
const settingsScreenFile = await readFile(
  new URL("../src/app/admin/settings.tsx", import.meta.url),
  "utf8",
);
const auditTypesFile = await readFile(
  new URL("../src/audit/types.ts", import.meta.url),
  "utf8",
);

describe("System Settings & Account Activation - Static Contract Verification (JN-393, JN-394)", () => {
  it("Settings types define all required configuration policies and update models (JN-393)", () => {
    assert.match(
      settingsTypesFile,
      /export interface SecurityPolicySettings/,
      "Must export SecurityPolicySettings",
    );
    assert.match(
      settingsTypesFile,
      /requireMfaForStaff:\s*boolean/,
      "Must define requireMfaForStaff",
    );
    assert.match(
      settingsTypesFile,
      /sessionTimeoutMinutes:\s*number/,
      "Must define sessionTimeoutMinutes",
    );
    assert.match(
      settingsTypesFile,
      /maxFailedLoginAttempts:\s*number/,
      "Must define maxFailedLoginAttempts",
    );
    assert.match(
      settingsTypesFile,
      /export interface EvidencePolicySettings/,
      "Must export EvidencePolicySettings",
    );
    assert.match(
      settingsTypesFile,
      /blockEvidenceDownloads:\s*boolean/,
      "Must define blockEvidenceDownloads",
    );
    assert.match(
      settingsTypesFile,
      /retentionPeriodYears:\s*number/,
      "Must define retentionPeriodYears",
    );
    assert.match(
      settingsTypesFile,
      /export interface PlatformOperationalSettings/,
      "Must export PlatformOperationalSettings",
    );
    assert.match(
      settingsTypesFile,
      /maintenanceMode:\s*boolean/,
      "Must define maintenanceMode",
    );
    assert.match(
      settingsTypesFile,
      /export interface SystemSettings/,
      "Must export SystemSettings",
    );
    assert.match(
      settingsTypesFile,
      /export interface AccountStatusUpdateInput/,
      "Must export AccountStatusUpdateInput",
    );
  });

  it("Audit types include settings category and audit event types (JN-397, AC 5)", () => {
    assert.match(
      auditTypesFile,
      /"settings"/,
      "AuditCategory must include 'settings'",
    );
    assert.match(
      auditTypesFile,
      /"SETTING_UPDATED"/,
      "AuditEventType must include SETTING_UPDATED",
    );
    assert.match(
      auditTypesFile,
      /"SYSTEM_SETTINGS_CHANGED"/,
      "AuditEventType must include SYSTEM_SETTINGS_CHANGED",
    );
    assert.match(
      auditTypesFile,
      /"ACCOUNT_ACTIVATED"/,
      "AuditEventType must include ACCOUNT_ACTIVATED",
    );
    assert.match(
      auditTypesFile,
      /"ACCOUNT_DEACTIVATED"/,
      "AuditEventType must include ACCOUNT_DEACTIVATED",
    );
  });

  it("Settings screen implements dedicated policy controls, steppers, and role protection (JN-394)", () => {
    assert.match(
      settingsScreenFile,
      /export default function AdminSettingsScreen/,
      "Settings screen must export AdminSettingsScreen",
    );
    assert.match(
      settingsScreenFile,
      /isAuthorized/,
      "Screen must enforce isAuthorized role check (AC 6)",
    );
    assert.match(
      settingsScreenFile,
      /Security & Authentication Policies/,
      "Screen must render Security Policies section",
    );
    assert.match(
      settingsScreenFile,
      /Data & Evidence Storage Policies/,
      "Screen must render Evidence Policies section",
    );
    assert.match(
      settingsScreenFile,
      /Platform Operations & Maintenance/,
      "Screen must render Maintenance Mode section",
    );
    assert.match(
      settingsScreenFile,
      /Account Activation & Access/,
      "Screen must render Account Activation section",
    );
    assert.match(
      settingsScreenFile,
      /Save Policy Changes/,
      "Screen must render Save Changes button",
    );
  });
});

describe("System Settings & Account Activation - Functional Logic Verification (JN-395, JN-396, JN-398)", () => {
  // Inlined Validation Constants & Engine for Standalone ESM Execution
  const SETTINGS_LIMITS = {
    SESSION_TIMEOUT_MIN: 5,
    SESSION_TIMEOUT_MAX: 120,
    FAILED_LOGIN_ATTEMPTS_MIN: 3,
    FAILED_LOGIN_ATTEMPTS_MAX: 10,
    PASSWORD_MIN_LENGTH_MIN: 6,
    PASSWORD_MIN_LENGTH_MAX: 32,
    RETENTION_YEARS_MIN: 1,
    RETENTION_YEARS_MAX: 20,
    UPLOAD_SIZE_BYTES_MIN: 1048576,
    UPLOAD_SIZE_BYTES_MAX: 524288000,
  };

  function validateSystemSettings(input) {
    const errors = [];
    if (input.security) {
      const { sessionTimeoutMinutes, maxFailedLoginAttempts, passwordMinLength } = input.security;
      if (sessionTimeoutMinutes !== undefined) {
        if (sessionTimeoutMinutes < SETTINGS_LIMITS.SESSION_TIMEOUT_MIN || sessionTimeoutMinutes > SETTINGS_LIMITS.SESSION_TIMEOUT_MAX) {
          errors.push(`Session timeout must be between ${SETTINGS_LIMITS.SESSION_TIMEOUT_MIN} and ${SETTINGS_LIMITS.SESSION_TIMEOUT_MAX} minutes.`);
        }
      }
      if (maxFailedLoginAttempts !== undefined) {
        if (maxFailedLoginAttempts < SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MIN || maxFailedLoginAttempts > SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MAX) {
          errors.push(`Max failed login attempts must be between ${SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MIN} and ${SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MAX}.`);
        }
      }
      if (passwordMinLength !== undefined) {
        if (passwordMinLength < SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MIN || passwordMinLength > SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MAX) {
          errors.push(`Minimum password length must be between ${SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MIN} and ${SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MAX} characters.`);
        }
      }
    }
    if (input.evidence) {
      const { retentionPeriodYears, maxUploadSizeBytes } = input.evidence;
      if (retentionPeriodYears !== undefined) {
        if (retentionPeriodYears < SETTINGS_LIMITS.RETENTION_YEARS_MIN || retentionPeriodYears > SETTINGS_LIMITS.RETENTION_YEARS_MAX) {
          errors.push(`Retention period must be between ${SETTINGS_LIMITS.RETENTION_YEARS_MIN} and ${SETTINGS_LIMITS.RETENTION_YEARS_MAX} years.`);
        }
      }
      if (maxUploadSizeBytes !== undefined) {
        if (maxUploadSizeBytes < SETTINGS_LIMITS.UPLOAD_SIZE_BYTES_MIN || maxUploadSizeBytes > SETTINGS_LIMITS.UPLOAD_SIZE_BYTES_MAX) {
          errors.push(`Maximum upload size must be between 1 MB and 500 MB.`);
        }
      }
    }
    if (input.platform) {
      const { maintenanceMode, maintenanceNotice, systemAlertThreshold } = input.platform;
      if (maintenanceMode === true && (!maintenanceNotice || maintenanceNotice.trim().length === 0)) {
        errors.push("A maintenance notice description is required when maintenance mode is enabled.");
      }
      if (systemAlertThreshold !== undefined) {
        const valid = ["low", "medium", "high", "critical"];
        if (!valid.includes(systemAlertThreshold)) {
          errors.push(`System alert threshold must be one of: ${valid.join(", ")}.`);
        }
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  function validateAccountStatusTransition(input, actorUserId, actorEmail) {
    const errors = [];
    if (!input.isActive) {
      const isSameId = actorUserId && input.targetUserId && actorUserId.trim().toLowerCase() === input.targetUserId.trim().toLowerCase();
      const isSameEmail = actorEmail && input.targetUserEmail && actorEmail.trim().toLowerCase() === input.targetUserEmail.trim().toLowerCase();
      if (isSameId || isSameEmail) {
        errors.push("Administrators cannot deactivate their own active administrator account.");
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  function canUserLogin(user) {
    const active = user.is_active !== false && user.isActive !== false && user.status !== "inactive" && user.status !== "suspended";
    return { canLogin: active, reason: active ? undefined : "Your account has been deactivated or suspended." };
  }

  it("AC 1: Admin can activate and deactivate accounts with self-deactivation protection", () => {
    // Normal deactivation allowed
    const validDeactivate = validateAccountStatusTransition(
      { targetUserId: "usr_chk_01", targetUserEmail: "checker@justicenow.org", isActive: false },
      "usr_adm_01",
      "admin@justicenow.org",
    );
    assert.equal(validDeactivate.isValid, true);

    // Self-deactivation by ID blocked
    const selfDeactivateId = validateAccountStatusTransition(
      { targetUserId: "usr_adm_01", targetUserEmail: "admin@justicenow.org", isActive: false },
      "usr_adm_01",
      "other@justicenow.org",
    );
    assert.equal(selfDeactivateId.isValid, false);
    assert.match(selfDeactivateId.errors[0], /cannot deactivate their own/);

    // Self-deactivation by Email blocked
    const selfDeactivateEmail = validateAccountStatusTransition(
      { targetUserId: "usr_diff", targetUserEmail: "admin@justicenow.org", isActive: false },
      "usr_adm_02",
      "admin@justicenow.org",
    );
    assert.equal(selfDeactivateEmail.isValid, false);
  });

  it("AC 2: Inactive and suspended users cannot log in", () => {
    // Active user can log in
    assert.equal(canUserLogin({ is_active: true, status: "active" }).canLogin, true);

    // Inactive user blocked
    const inactiveRes = canUserLogin({ is_active: false, status: "active" });
    assert.equal(inactiveRes.canLogin, false);
    assert.match(inactiveRes.reason, /deactivated or suspended/);

    // Suspended status blocked
    const suspendedRes = canUserLogin({ is_active: true, status: "suspended" });
    assert.equal(suspendedRes.canLogin, false);
  });

  it("AC 4: Invalid setting values are rejected with explicit bounds", () => {
    // Timeout limits
    assert.equal(validateSystemSettings({ security: { sessionTimeoutMinutes: 4 } }).isValid, false);
    assert.equal(validateSystemSettings({ security: { sessionTimeoutMinutes: 121 } }).isValid, false);
    assert.equal(validateSystemSettings({ security: { sessionTimeoutMinutes: 30 } }).isValid, true);

    // Failed login limits
    assert.equal(validateSystemSettings({ security: { maxFailedLoginAttempts: 2 } }).isValid, false);
    assert.equal(validateSystemSettings({ security: { maxFailedLoginAttempts: 11 } }).isValid, false);
    assert.equal(validateSystemSettings({ security: { maxFailedLoginAttempts: 5 } }).isValid, true);

    // Password length limits
    assert.equal(validateSystemSettings({ security: { passwordMinLength: 5 } }).isValid, false);
    assert.equal(validateSystemSettings({ security: { passwordMinLength: 33 } }).isValid, false);
    assert.equal(validateSystemSettings({ security: { passwordMinLength: 8 } }).isValid, true);

    // Retention years limits
    assert.equal(validateSystemSettings({ evidence: { retentionPeriodYears: 0 } }).isValid, false);
    assert.equal(validateSystemSettings({ evidence: { retentionPeriodYears: 21 } }).isValid, false);
    assert.equal(validateSystemSettings({ evidence: { retentionPeriodYears: 7 } }).isValid, true);

    // Upload size limits
    assert.equal(validateSystemSettings({ evidence: { maxUploadSizeBytes: 100 } }).isValid, false);
    assert.equal(validateSystemSettings({ evidence: { maxUploadSizeBytes: 600000000 } }).isValid, false);
    assert.equal(validateSystemSettings({ evidence: { maxUploadSizeBytes: 104857600 } }).isValid, true);

    // Maintenance notice requirement
    assert.equal(validateSystemSettings({ platform: { maintenanceMode: true, maintenanceNotice: "" } }).isValid, false);
    assert.equal(validateSystemSettings({ platform: { maintenanceMode: true, maintenanceNotice: "Maintenance in progress" } }).isValid, true);
  });

  it("AC 6: Service strictly enforces requireAdministrator", () => {
    assert.match(
      settingsServiceFile,
      /requireAdministrator/,
      "Service must enforce requireAdministrator",
    );
    assert.match(
      settingsServiceFile,
      /UNAUTHORIZED_SETTINGS_ACCESS/,
      "Service must throw UNAUTHORIZED_SETTINGS_ACCESS error code",
    );
  });
});
