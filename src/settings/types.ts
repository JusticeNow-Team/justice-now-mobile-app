import { SystemRole } from "../auth/types";

export interface SecurityPolicySettings {
  requireMfaForStaff: boolean;
  sessionTimeoutMinutes: number; // 5 - 120
  maxFailedLoginAttempts: number; // 3 - 10
  passwordMinLength: number; // 6 - 32
}

export interface EvidencePolicySettings {
  blockEvidenceDownloads: boolean;
  retentionPeriodYears: number; // 1 - 20
  maxUploadSizeBytes: number; // 1MB (1,048,576) to 500MB (524,288,000)
}

export interface PlatformOperationalSettings {
  maintenanceMode: boolean;
  maintenanceNotice: string;
  allowNewRegistrations: boolean;
  systemAlertThreshold: "low" | "medium" | "high" | "critical";
}

export interface SystemSettings {
  id: string;
  security: SecurityPolicySettings;
  evidence: EvidencePolicySettings;
  platform: PlatformOperationalSettings;
  updatedAt: string;
  updatedBy: string;
}

export interface UpdateSystemSettingsInput {
  security?: Partial<SecurityPolicySettings>;
  evidence?: Partial<EvidencePolicySettings>;
  platform?: Partial<PlatformOperationalSettings>;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface AccountStatusUpdateInput {
  targetUserId: string;
  targetUserEmail: string;
  targetUserRole?: SystemRole;
  isActive: boolean;
  reason?: string;
}

export interface AccountStatusUpdateResult {
  success: boolean;
  isActive: boolean;
  status: "active" | "inactive" | "suspended";
  error?: string;
}
