import { SystemSettings } from "../types";

export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  id: "sys_settings_global",
  security: {
    requireMfaForStaff: true,
    sessionTimeoutMinutes: 15,
    maxFailedLoginAttempts: 5,
    passwordMinLength: 8,
  },
  evidence: {
    blockEvidenceDownloads: true,
    retentionPeriodYears: 7,
    maxUploadSizeBytes: 104857600, // 100 MB
  },
  platform: {
    maintenanceMode: false,
    maintenanceNotice: "System undergoing scheduled maintenance. Please check back shortly.",
    allowNewRegistrations: true,
    systemAlertThreshold: "medium",
  },
  updatedAt: "2026-08-01T00:00:00.000Z",
  updatedBy: "system_bootstrap",
};
