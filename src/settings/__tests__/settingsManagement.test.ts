import {
  canUserLogin,
  getSystemSettings,
  requireAdministrator,
  resetSettingsStoreForTesting,
  setAccountActivationStatus,
  updateSystemSettings,
} from "../settingsService";
import {
  validateAccountStatusTransition,
  validateSystemSettings,
} from "../validation";
import { INITIAL_SYSTEM_SETTINGS } from "../seeds/settingsSeed";

describe("System Settings & Account Activation Management (JN-393 to JN-398)", () => {
  beforeEach(() => {
    resetSettingsStoreForTesting();
  });

  describe("AC 1 & JN-396: Account Activation & Deactivation Management", () => {
    it("activates and deactivates accounts successfully", async () => {
      // Deactivate target user
      const deactivateResult = await setAccountActivationStatus(
        {
          targetUserId: "usr_officer_99",
          targetUserEmail: "officer.target@justicenow.org",
          targetUserRole: "case_officer",
          isActive: false,
          reason: "Temporary administrative leave",
        },
        "admin@justicenow.org",
        "system_admin",
        "admin_user_01",
      );

      expect(deactivateResult.success).toBe(true);
      expect(deactivateResult.isActive).toBe(false);
      expect(deactivateResult.status).toBe("inactive");

      // Reactivate target user
      const activateResult = await setAccountActivationStatus(
        {
          targetUserId: "usr_officer_99",
          targetUserEmail: "officer.target@justicenow.org",
          targetUserRole: "case_officer",
          isActive: true,
          reason: "Returned from leave",
        },
        "admin@justicenow.org",
        "system_admin",
        "admin_user_01",
      );

      expect(activateResult.success).toBe(true);
      expect(activateResult.isActive).toBe(true);
      expect(activateResult.status).toBe("active");
    });

    it("prevents administrators from deactivating their own active account", async () => {
      const selfDeactivateResult = await setAccountActivationStatus(
        {
          targetUserId: "admin_user_01",
          targetUserEmail: "admin@justicenow.org",
          targetUserRole: "system_admin",
          isActive: false,
        },
        "admin@justicenow.org",
        "system_admin",
        "admin_user_01",
      );

      expect(selfDeactivateResult.success).toBe(false);
      expect(selfDeactivateResult.error).toMatch(
        /cannot deactivate their own active administrator account/,
      );
    });

    it("validation detects self-deactivation attempt by ID and by Email", () => {
      const resById = validateAccountStatusTransition(
        {
          targetUserId: "admin_01",
          targetUserEmail: "other@email.com",
          isActive: false,
        },
        "admin_01",
        "actor@email.com",
      );
      expect(resById.isValid).toBe(false);
      expect(resById.errors[0]).toMatch(/cannot deactivate their own/);

      const resByEmail = validateAccountStatusTransition(
        {
          targetUserId: "user_diff",
          targetUserEmail: "admin@justicenow.org",
          isActive: false,
        },
        "admin_02",
        "admin@justicenow.org",
      );
      expect(resByEmail.isValid).toBe(false);
    });
  });

  describe("AC 2 & JN-396: Inactive Users Login Restrictions", () => {
    it("allows active user accounts to log in", () => {
      const result = canUserLogin({
        is_active: true,
        status: "active",
      });
      expect(result.canLogin).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("blocks inactive and suspended user accounts from logging in", () => {
      const inactive1 = canUserLogin({
        is_active: false,
        status: "active",
      });
      expect(inactive1.canLogin).toBe(false);
      expect(inactive1.reason).toMatch(/account has been deactivated/);

      const inactive2 = canUserLogin({
        is_active: true,
        status: "inactive",
      });
      expect(inactive2.canLogin).toBe(false);

      const suspended = canUserLogin({
        is_active: true,
        status: "suspended",
      });
      expect(suspended.canLogin).toBe(false);
      expect(suspended.reason).toMatch(/account has been deactivated or suspended/);
    });
  });

  describe("AC 3 & JN-393: Configurable Settings Structure & Defaults", () => {
    it("retrieves current system settings with security, evidence, and platform policies", async () => {
      const settings = await getSystemSettings("system_admin");

      expect(settings).toBeDefined();
      expect(settings.security.requireMfaForStaff).toBe(true);
      expect(settings.security.sessionTimeoutMinutes).toBe(15);
      expect(settings.evidence.blockEvidenceDownloads).toBe(true);
      expect(settings.evidence.retentionPeriodYears).toBe(7);
      expect(settings.platform.maintenanceMode).toBe(false);
      expect(settings.platform.allowNewRegistrations).toBe(true);
    });
  });

  describe("AC 4 & JN-395: Settings Validation & Range Constraints", () => {
    it("accepts valid system settings within limits", () => {
      const valid = validateSystemSettings({
        security: {
          sessionTimeoutMinutes: 30,
          maxFailedLoginAttempts: 5,
          passwordMinLength: 12,
        },
        evidence: {
          retentionPeriodYears: 10,
          maxUploadSizeBytes: 52428800, // 50MB
        },
        platform: {
          maintenanceMode: true,
          maintenanceNotice: "Upgrading security firmware",
          systemAlertThreshold: "high",
        },
      });

      expect(valid.isValid).toBe(true);
      expect(valid.errors.length).toBe(0);
    });

    it("rejects session timeout outside allowed range (5 to 120 mins)", () => {
      const low = validateSystemSettings({
        security: { sessionTimeoutMinutes: 2 },
      });
      expect(low.isValid).toBe(false);
      expect(low.errors[0]).toMatch(/Session timeout must be between 5 and 120/);

      const high = validateSystemSettings({
        security: { sessionTimeoutMinutes: 240 },
      });
      expect(high.isValid).toBe(false);
    });

    it("rejects max failed login attempts outside allowed range (3 to 10)", () => {
      const low = validateSystemSettings({
        security: { maxFailedLoginAttempts: 1 },
      });
      expect(low.isValid).toBe(false);
      expect(low.errors[0]).toMatch(/Max failed login attempts must be between 3 and 10/);

      const high = validateSystemSettings({
        security: { maxFailedLoginAttempts: 15 },
      });
      expect(high.isValid).toBe(false);
    });

    it("rejects password min length outside allowed range (6 to 32 chars)", () => {
      const low = validateSystemSettings({
        security: { passwordMinLength: 4 },
      });
      expect(low.isValid).toBe(false);
      expect(low.errors[0]).toMatch(/Minimum password length must be between 6 and 32/);

      const high = validateSystemSettings({
        security: { passwordMinLength: 64 },
      });
      expect(high.isValid).toBe(false);
    });

    it("rejects retention period outside allowed range (1 to 20 years)", () => {
      const low = validateSystemSettings({
        evidence: { retentionPeriodYears: 0 },
      });
      expect(low.isValid).toBe(false);
      expect(low.errors[0]).toMatch(/Retention period must be between 1 and 20 years/);

      const high = validateSystemSettings({
        evidence: { retentionPeriodYears: 25 },
      });
      expect(high.isValid).toBe(false);
    });

    it("rejects max upload size outside allowed range (1MB to 500MB)", () => {
      const low = validateSystemSettings({
        evidence: { maxUploadSizeBytes: 500 }, // < 1MB
      });
      expect(low.isValid).toBe(false);
      expect(low.errors[0]).toMatch(/Maximum upload size must be between 1 MB and 500 MB/);

      const high = validateSystemSettings({
        evidence: { maxUploadSizeBytes: 1000000000 }, // 1GB > 500MB
      });
      expect(high.isValid).toBe(false);
    });

    it("rejects empty maintenance notice when maintenance mode is enabled", () => {
      const invalid = validateSystemSettings({
        platform: {
          maintenanceMode: true,
          maintenanceNotice: "",
        },
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors[0]).toMatch(/maintenance notice description is required/);
    });

    it("rejects invalid system alert threshold", () => {
      const invalid = validateSystemSettings({
        platform: {
          systemAlertThreshold: "extreme" as any,
        },
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors[0]).toMatch(/System alert threshold must be one of/);
    });
  });

  describe("AC 5 & JN-397: Settings Update & Audit Emission", () => {
    it("persists valid settings updates and returns updated state", async () => {
      const updateResult = await updateSystemSettings(
        {
          security: { sessionTimeoutMinutes: 45, passwordMinLength: 10 },
          evidence: { retentionPeriodYears: 12 },
        },
        "chief.admin@justicenow.org",
        "system_admin",
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.settings?.security.sessionTimeoutMinutes).toBe(45);
      expect(updateResult.settings?.security.passwordMinLength).toBe(10);
      expect(updateResult.settings?.evidence.retentionPeriodYears).toBe(12);
      expect(updateResult.settings?.updatedBy).toBe("chief.admin@justicenow.org");
    });

    it("rejects updating settings with invalid input and preserves previous state", async () => {
      const failResult = await updateSystemSettings(
        {
          security: { sessionTimeoutMinutes: 999 },
        },
        "admin@justicenow.org",
        "system_admin",
      );

      expect(failResult.success).toBe(false);
      expect(failResult.error).toMatch(/Session timeout must be between 5 and 120/);

      const current = await getSystemSettings("system_admin");
      expect(current.security.sessionTimeoutMinutes).toBe(
        INITIAL_SYSTEM_SETTINGS.security.sessionTimeoutMinutes,
      );
    });
  });

  describe("AC 6 & JN-398: Role-Based Access Control", () => {
    it("permits authorized system_admin", () => {
      expect(() => requireAdministrator("system_admin")).not.toThrow();
      expect(() => requireAdministrator("System Administrator")).not.toThrow();
    });

    it("rejects unauthorized roles from retrieving or updating settings", async () => {
      expect(() => requireAdministrator("reporter")).toThrow(
        /strictly restricted to System Administrators/,
      );
      expect(() => requireAdministrator("case_officer")).toThrow(
        /strictly restricted to System Administrators/,
      );
      expect(() => requireAdministrator("evidence_checker")).toThrow(
        /strictly restricted to System Administrators/,
      );

      await expect(getSystemSettings("case_officer")).rejects.toThrow(
        /strictly restricted to System Administrators/,
      );

      await expect(
        updateSystemSettings(
          { security: { sessionTimeoutMinutes: 30 } },
          "attacker@evil.com",
          "reporter",
        ),
      ).rejects.toThrow(/strictly restricted to System Administrators/);
    });
  });
});
