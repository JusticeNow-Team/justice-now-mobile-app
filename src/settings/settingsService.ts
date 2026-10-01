import { recordAuditEvent } from "../audit/auditService";
import { AuthorizationError } from "../auth/middleware";
import { normalizeRole } from "../auth/roles";
import { supabase } from "../lib/supabase";
import { INITIAL_SYSTEM_SETTINGS } from "./seeds/settingsSeed";
import {
  AccountStatusUpdateInput,
  AccountStatusUpdateResult,
  SystemSettings,
  UpdateSystemSettingsInput,
} from "./types";
import {
  validateAccountStatusTransition,
  validateSystemSettings,
} from "./validation";

// In-memory runtime/test store
let inMemorySettings: SystemSettings = JSON.parse(
  JSON.stringify(INITIAL_SYSTEM_SETTINGS),
);

// In-memory account store for testing offline / demo
let inMemoryAccountStatuses: Map<string, { isActive: boolean; status: string }> =
  new Map();

// ============================================================================
// SECURITY & ROLE GUARD (AC 6)
// ============================================================================

export function requireAdministrator(actorRole?: string): void {
  const normalized = normalizeRole(actorRole);
  if (normalized !== "system_admin") {
    throw new AuthorizationError(
      `Unauthorized: System Settings and Account Activation controls are strictly restricted to System Administrators. Current role: ${actorRole ?? "anonymous"}`,
      "UNAUTHORIZED_SETTINGS_ACCESS",
      403,
    );
  }
}

// ============================================================================
// SYSTEM SETTINGS SERVICE (JN-393, JN-394, JN-395, JN-397, AC 3, 4, 5, 6)
// ============================================================================

export async function getSystemSettings(
  actorRole = "system_admin",
): Promise<SystemSettings> {
  requireAdministrator(actorRole);

  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (!error && data && data.settings_json) {
      return {
        id: data.id || inMemorySettings.id,
        security: { ...inMemorySettings.security, ...data.settings_json.security },
        evidence: { ...inMemorySettings.evidence, ...data.settings_json.evidence },
        platform: { ...inMemorySettings.platform, ...data.settings_json.platform },
        updatedAt: data.updated_at || inMemorySettings.updatedAt,
        updatedBy: data.updated_by || inMemorySettings.updatedBy,
      };
    }
  } catch {
    // Fall back to in-memory store
  }

  return JSON.parse(JSON.stringify(inMemorySettings));
}

export async function updateSystemSettings(
  input: UpdateSystemSettingsInput,
  actorEmail = "admin@justicenow.org",
  actorRole = "system_admin",
): Promise<{ success: boolean; settings?: SystemSettings; error?: string }> {
  // AC 6: Role security
  requireAdministrator(actorRole);

  // AC 4: Validation
  const validation = validateSystemSettings(input);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join(" "),
    };
  }

  const previous = JSON.parse(JSON.stringify(inMemorySettings));

  const updated: SystemSettings = {
    ...inMemorySettings,
    security: {
      ...inMemorySettings.security,
      ...(input.security || {}),
    },
    evidence: {
      ...inMemorySettings.evidence,
      ...(input.evidence || {}),
    },
    platform: {
      ...inMemorySettings.platform,
      ...(input.platform || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };

  inMemorySettings = updated;

  // Persist to Supabase if connected
  try {
    await supabase.from("system_settings").upsert({
      id: "global",
      settings_json: {
        security: updated.security,
        evidence: updated.evidence,
        platform: updated.platform,
      },
      updated_at: updated.updatedAt,
      updated_by: updated.updatedBy,
    });
  } catch {
    // Keep in-memory update
  }

  // AC 5: Record Audit Event
  try {
    await recordAuditEvent(
      {
        eventType: "SYSTEM_SETTINGS_CHANGED",
        actorEmail,
        actorRole: "system_admin",
        targetEmail: "system@justicenow.org",
        targetId: "global_settings",
        action: "Updated System Configuration & Policies",
        description: `System administrator ${actorEmail} updated platform security & operational settings.`,
        details: {
          previous,
          updated,
          changes: input,
        },
      });
  } catch (auditErr) {
    console.warn("Audit logging failed during settings update:", auditErr);
  }

  return {
    success: true,
    settings: JSON.parse(JSON.stringify(inMemorySettings)),
  };
}

// ============================================================================
// ACCOUNT ACTIVATION & DEACTIVATION MANAGEMENT (JN-396, AC 1, 2, 5)
// ============================================================================

export async function setAccountActivationStatus(
  input: AccountStatusUpdateInput,
  actorEmail = "admin@justicenow.org",
  actorRole = "system_admin",
  actorUserId?: string,
): Promise<AccountStatusUpdateResult> {
  // AC 6: Role security
  requireAdministrator(actorRole);

  // AC 1: Self-deactivation prevention
  const validation = validateAccountStatusTransition(input, actorUserId, actorEmail);
  if (!validation.isValid) {
    return {
      success: false,
      isActive: !input.isActive,
      status: !input.isActive ? "active" : "inactive",
      error: validation.errors.join(" "),
    };
  }

  const nextStatus = input.isActive ? "active" : "inactive";
  inMemoryAccountStatuses.set(input.targetUserId || input.targetUserEmail, {
    isActive: input.isActive,
    status: nextStatus,
  });

  // Attempt live update in Supabase profiles
  try {
    if (input.targetUserId) {
      await supabase
        .from("profiles")
        .update({
          is_active: input.isActive,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.targetUserId);
    } else if (input.targetUserEmail) {
      await supabase
        .from("profiles")
        .update({
          is_active: input.isActive,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("email", input.targetUserEmail);
    }
  } catch {
    // Keep in-memory update
  }

  // AC 5: Record Audit Event
  const eventType = input.isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED";
  const actionText = input.isActive ? "Activated Account" : "Deactivated Account";

  try {
    await recordAuditEvent(
      {
        eventType,
        actorEmail,
        actorRole: "system_admin",
        targetEmail: input.targetUserEmail,
        targetId: input.targetUserId,
        action: actionText,
        description: `Administrator ${actorEmail} set account status to ${nextStatus} for ${input.targetUserEmail}. Reason: ${input.reason || "Administrative action"}`,
        details: {
          targetUserId: input.targetUserId,
          targetUserEmail: input.targetUserEmail,
          targetUserRole: input.targetUserRole,
          isActive: input.isActive,
          status: nextStatus,
          reason: input.reason || "Administrative action",
        },
      });
  } catch (auditErr) {
    console.warn("Audit logging failed during account activation update:", auditErr);
  }

  return {
    success: true,
    isActive: input.isActive,
    status: nextStatus,
  };
}

/**
 * Evaluates whether an account is active and allowed to log in (AC 2).
 */
export function canUserLogin(user: {
  is_active?: boolean;
  isActive?: boolean;
  status?: string;
}): { canLogin: boolean; reason?: string } {
  const active =
    user.is_active !== false &&
    user.isActive !== false &&
    user.status !== "inactive" &&
    user.status !== "suspended";

  if (!active) {
    return {
      canLogin: false,
      reason:
        "Your account has been deactivated or suspended. Please contact a System Administrator.",
    };
  }

  return { canLogin: true };
}

// ============================================================================
// TEST & RUNTIME RE-INITIALIZATION
// ============================================================================

export function resetSettingsStoreForTesting(override?: Partial<SystemSettings>): void {
  inMemorySettings = {
    ...JSON.parse(JSON.stringify(INITIAL_SYSTEM_SETTINGS)),
    ...(override || {}),
  };
  inMemoryAccountStatuses.clear();
}
