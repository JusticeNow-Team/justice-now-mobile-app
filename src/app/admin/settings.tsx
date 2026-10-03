import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth";
import { normalizeRole } from "../../auth/roles";
import { AppIcon } from "../../components/AppIcon";
import {
  getSystemSettings,
  SETTINGS_LIMITS,
  SystemSettings,
  updateSystemSettings,
  validateSystemSettings,
} from "../../settings";
import { colors } from "../../theme";

const UPLOAD_SIZE_OPTIONS = [
  { label: "10 MB", bytes: 10485760 },
  { label: "50 MB", bytes: 52428800 },
  { label: "100 MB", bytes: 104857600 },
  { label: "250 MB", bytes: 262144000 },
  { label: "500 MB", bytes: 524288000 },
];

const THRESHOLD_OPTIONS: { id: "low" | "medium" | "high" | "critical"; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

function formatTime(isoString?: string): string {
  if (!isoString) return "Just now";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const userRole = normalizeRole(user?.role);
  const isAuthorized = userRole === "system_admin";

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [formState, setFormState] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const current = await getSystemSettings(user?.role || "system_admin");
      setSettings(current);
      setFormState(JSON.parse(JSON.stringify(current)));
      setHasChanges(false);
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      setErrorMessage(err?.message || "Unable to load system settings.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSettings]);

  const handleToggleSecurityMfa = (val: boolean) => {
    if (!formState) return;
    setFormState({
      ...formState,
      security: { ...formState.security, requireMfaForStaff: val },
    });
    setHasChanges(true);
  };

  const handleSessionTimeoutChange = (delta: number) => {
    if (!formState) return;
    const current = formState.security.sessionTimeoutMinutes;
    const next = Math.min(
      SETTINGS_LIMITS.SESSION_TIMEOUT_MAX,
      Math.max(SETTINGS_LIMITS.SESSION_TIMEOUT_MIN, current + delta),
    );
    setFormState({
      ...formState,
      security: { ...formState.security, sessionTimeoutMinutes: next },
    });
    setHasChanges(true);
  };

  const handleFailedAttemptsChange = (delta: number) => {
    if (!formState) return;
    const current = formState.security.maxFailedLoginAttempts;
    const next = Math.min(
      SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MAX,
      Math.max(SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MIN, current + delta),
    );
    setFormState({
      ...formState,
      security: { ...formState.security, maxFailedLoginAttempts: next },
    });
    setHasChanges(true);
  };

  const handlePasswordLengthChange = (delta: number) => {
    if (!formState) return;
    const current = formState.security.passwordMinLength;
    const next = Math.min(
      SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MAX,
      Math.max(SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MIN, current + delta),
    );
    setFormState({
      ...formState,
      security: { ...formState.security, passwordMinLength: next },
    });
    setHasChanges(true);
  };

  const handleToggleDownloads = (val: boolean) => {
    if (!formState) return;
    setFormState({
      ...formState,
      evidence: { ...formState.evidence, blockEvidenceDownloads: val },
    });
    setHasChanges(true);
  };

  const handleRetentionYearsChange = (delta: number) => {
    if (!formState) return;
    const current = formState.evidence.retentionPeriodYears;
    const next = Math.min(
      SETTINGS_LIMITS.RETENTION_YEARS_MAX,
      Math.max(SETTINGS_LIMITS.RETENTION_YEARS_MIN, current + delta),
    );
    setFormState({
      ...formState,
      evidence: { ...formState.evidence, retentionPeriodYears: next },
    });
    setHasChanges(true);
  };

  const handleUploadSizeSelect = (bytes: number) => {
    if (!formState) return;
    setFormState({
      ...formState,
      evidence: { ...formState.evidence, maxUploadSizeBytes: bytes },
    });
    setHasChanges(true);
  };

  const handleToggleMaintenance = (val: boolean) => {
    if (!formState) return;
    setFormState({
      ...formState,
      platform: { ...formState.platform, maintenanceMode: val },
    });
    setHasChanges(true);
  };

  const handleToggleRegistrations = (val: boolean) => {
    if (!formState) return;
    setFormState({
      ...formState,
      platform: { ...formState.platform, allowNewRegistrations: val },
    });
    setHasChanges(true);
  };

  const handleMaintenanceNoticeChange = (text: string) => {
    if (!formState) return;
    setFormState({
      ...formState,
      platform: { ...formState.platform, maintenanceNotice: text },
    });
    setHasChanges(true);
  };

  const handleThresholdSelect = (threshold: "low" | "medium" | "high" | "critical") => {
    if (!formState) return;
    setFormState({
      ...formState,
      platform: { ...formState.platform, systemAlertThreshold: threshold },
    });
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!formState) return;

    setErrorMessage("");
    setSuccessMessage("");

    // Validate (AC 4)
    const validation = validateSystemSettings(formState);
    if (!validation.isValid) {
      setErrorMessage(validation.errors.join("\n"));
      return;
    }

    try {
      setSaving(true);
      const result = await updateSystemSettings(
        formState,
        user?.email || "admin@justicenow.org",
        user?.role || "system_admin",
      );

      if (!result.success || !result.settings) {
        setErrorMessage(result.error || "Unable to save system settings.");
        return;
      }

      setSettings(result.settings);
      setFormState(JSON.parse(JSON.stringify(result.settings)));
      setHasChanges(false);
      setSuccessMessage("System configuration and policies updated successfully.");

      if (Platform.OS === "web") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      console.error("Save settings error:", err);
      setErrorMessage(err?.message || "Failed to update system settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    if (!settings) return;
    setFormState(JSON.parse(JSON.stringify(settings)));
    setHasChanges(false);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSignOut = () => {
    const message = "Administrator sessions end immediately when you sign out.";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Sign out?\n\n${message}`);
      if (confirmed) {
        void signOut().then(() => router.replace("/login"));
      }
      return;
    }

    Alert.alert("Sign out?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void signOut().then(() => router.replace("/login")),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screen}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.push("/admin")}
              accessibilityRole="button"
              accessibilityLabel="Back to Admin Overview"
            >
              <AppIcon name="arrow-left" size={20} color={colors.textInverse} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerSubtitle}>System Administration</Text>
              <Text style={styles.headerTitle}>System Settings & Policies</Text>
            </View>

            <Pressable
              style={styles.refreshButton}
              onPress={() => void loadSettings()}
              accessibilityRole="button"
              accessibilityLabel="Refresh Settings"
            >
              <AppIcon name="refresh-cw" size={18} color={colors.textInverse} />
            </Pressable>
          </View>

          {/* Subheader Metadata */}
          <View style={styles.statusMetaRow}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Policy Guard Active</Text>
            </View>
            <Text style={styles.timestampText}>
              Last Saved: {formatTime(settings?.updatedAt)}
            </Text>
          </View>
        </View>

        {/* Unauthorized View (AC 6) */}
        {!isAuthorized ? (
          <View style={styles.unauthorizedContainer}>
            <View style={styles.unauthorizedIconBox}>
              <AppIcon name="shield-alert" size={36} color={colors.error} />
            </View>
            <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
            <Text style={styles.unauthorizedMessage}>
              System settings and account activation controls are strictly restricted to System Administrators.
            </Text>
            <Pressable
              style={styles.returnButton}
              onPress={() => router.push("/admin")}
            >
              <Text style={styles.returnButtonText}>Return to Overview</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Unsaved Changes Banner */}
            {hasChanges ? (
              <View style={styles.unsavedBanner}>
                <View style={styles.unsavedBannerLeft}>
                  <AppIcon name="alert-circle" size={16} color="#C05621" />
                  <Text style={styles.unsavedBannerText}>You have unsaved policy changes</Text>
                </View>
                <Pressable style={styles.saveQuickBtn} onPress={handleSaveChanges} disabled={saving}>
                  <Text style={styles.saveQuickBtnText}>{saving ? "Saving..." : "Save Now"}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Success Message Banner */}
            {successMessage ? (
              <View style={styles.successBanner}>
                <AppIcon name="check-circle" size={16} color={colors.success} />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Error Message Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <AppIcon name="alert-triangle" size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {loading && !formState ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading system policies...</Text>
              </View>
            ) : formState ? (
              <>
                {/* Section 1: Security & Authentication Policies (AC 3, AC 4) */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={styles.sectionBadge}>
                        <AppIcon name="lock" size={14} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>Security & Authentication Policies</Text>
                        <Text style={styles.sectionDescription}>
                          Enforce login security, session duration & lockout thresholds (JN-393, JN-395)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sectionBody}>
                    {/* Toggle: Require 2FA */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Require Two-Factor (2FA) for Staff</Text>
                        <Text style={styles.settingHint}>
                          Mandates authenticator app verification for Case Officers, Checkers & Admins
                        </Text>
                      </View>
                      <Switch
                        value={formState.security.requireMfaForStaff}
                        onValueChange={handleToggleSecurityMfa}
                        trackColor={{ false: colors.navy[100], true: colors.royal[700] }}
                        thumbColor={colors.surface}
                      />
                    </View>

                    {/* Stepper: Session Timeout */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Session Inactivity Timeout</Text>
                        <Text style={styles.settingHint}>
                          Automatic sign-out duration (Min: 5m, Max: 120m)
                        </Text>
                      </View>
                      <View style={styles.stepperContainer}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleSessionTimeoutChange(-5)}
                          disabled={formState.security.sessionTimeoutMinutes <= SETTINGS_LIMITS.SESSION_TIMEOUT_MIN}
                        >
                          <Text style={styles.stepperBtnText}>-</Text>
                        </Pressable>
                        <View style={styles.stepperValueBox}>
                          <Text style={styles.stepperValueText}>
                            {formState.security.sessionTimeoutMinutes} min
                          </Text>
                        </View>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleSessionTimeoutChange(5)}
                          disabled={formState.security.sessionTimeoutMinutes >= SETTINGS_LIMITS.SESSION_TIMEOUT_MAX}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Stepper: Max Failed Attempts */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Max Failed Sign-in Attempts</Text>
                        <Text style={styles.settingHint}>
                          Account lockout trigger threshold (Min: 3, Max: 10)
                        </Text>
                      </View>
                      <View style={styles.stepperContainer}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleFailedAttemptsChange(-1)}
                          disabled={formState.security.maxFailedLoginAttempts <= SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MIN}
                        >
                          <Text style={styles.stepperBtnText}>-</Text>
                        </Pressable>
                        <View style={styles.stepperValueBox}>
                          <Text style={styles.stepperValueText}>
                            {formState.security.maxFailedLoginAttempts}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleFailedAttemptsChange(1)}
                          disabled={formState.security.maxFailedLoginAttempts >= SETTINGS_LIMITS.FAILED_LOGIN_ATTEMPTS_MAX}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Stepper: Password Min Length */}
                    <View style={[styles.settingRow, styles.lastSettingRow]}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Minimum Password Length</Text>
                        <Text style={styles.settingHint}>
                          Password complexity standard (Min: 6, Max: 32 chars)
                        </Text>
                      </View>
                      <View style={styles.stepperContainer}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handlePasswordLengthChange(-1)}
                          disabled={formState.security.passwordMinLength <= SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MIN}
                        >
                          <Text style={styles.stepperBtnText}>-</Text>
                        </Pressable>
                        <View style={styles.stepperValueBox}>
                          <Text style={styles.stepperValueText}>
                            {formState.security.passwordMinLength} chars
                          </Text>
                        </View>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handlePasswordLengthChange(1)}
                          disabled={formState.security.passwordMinLength >= SETTINGS_LIMITS.PASSWORD_MIN_LENGTH_MAX}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Section 2: Data & Evidence Storage Policies (AC 3, AC 4) */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#E0F2FE" }]}>
                        <AppIcon name="file-search" size={14} color={colors.royal[700]} />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>Data & Evidence Storage Policies</Text>
                        <Text style={styles.sectionDescription}>
                          Retention schedules & upload restrictions (JN-393, JN-395)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sectionBody}>
                    {/* Toggle: Block Evidence Downloads */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Block Personal Device Downloads</Text>
                        <Text style={styles.settingHint}>
                          Restricts direct evidence export to authorized forensic stations only
                        </Text>
                      </View>
                      <Switch
                        value={formState.evidence.blockEvidenceDownloads}
                        onValueChange={handleToggleDownloads}
                        trackColor={{ false: colors.navy[100], true: colors.royal[700] }}
                        thumbColor={colors.surface}
                      />
                    </View>

                    {/* Stepper: Retention Years */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Case & Evidence Retention Period</Text>
                        <Text style={styles.settingHint}>
                          Audit & evidence statutory storage duration (Min: 1, Max: 20 years)
                        </Text>
                      </View>
                      <View style={styles.stepperContainer}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleRetentionYearsChange(-1)}
                          disabled={formState.evidence.retentionPeriodYears <= SETTINGS_LIMITS.RETENTION_YEARS_MIN}
                        >
                          <Text style={styles.stepperBtnText}>-</Text>
                        </Pressable>
                        <View style={styles.stepperValueBox}>
                          <Text style={styles.stepperValueText}>
                            {formState.evidence.retentionPeriodYears} years
                          </Text>
                        </View>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => handleRetentionYearsChange(1)}
                          disabled={formState.evidence.retentionPeriodYears >= SETTINGS_LIMITS.RETENTION_YEARS_MAX}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Selector Chips: Max Upload Size */}
                    <View style={[styles.settingColumnRow, styles.lastSettingRow]}>
                      <Text style={styles.settingLabel}>Maximum File Upload Size Limit</Text>
                      <Text style={styles.settingHint}>
                        Permitted single-file upload ceiling across all incident intakes
                      </Text>
                      <View style={styles.chipsRow}>
                        {UPLOAD_SIZE_OPTIONS.map((opt) => {
                          const active = formState.evidence.maxUploadSizeBytes === opt.bytes;
                          return (
                            <Pressable
                              key={opt.label}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => handleUploadSizeSelect(opt.bytes)}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Section 3: Platform Operations & Maintenance Mode (AC 3, AC 4) */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#FEF3C7" }]}>
                        <AppIcon name="activity" size={14} color="#C05621" />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>Platform Operations & Maintenance</Text>
                        <Text style={styles.sectionDescription}>
                          System availability and intake registration controls (JN-393, JN-395)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sectionBody}>
                    {/* Toggle: Maintenance Mode */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Maintenance Mode</Text>
                        <Text style={styles.settingHint}>
                          Temporarily blocks non-administrator access with notice
                        </Text>
                      </View>
                      <Switch
                        value={formState.platform.maintenanceMode}
                        onValueChange={handleToggleMaintenance}
                        trackColor={{ false: colors.navy[100], true: colors.warning }}
                        thumbColor={colors.surface}
                      />
                    </View>

                    {/* Maintenance Notice Input (When active) */}
                    {formState.platform.maintenanceMode ? (
                      <View style={styles.noticeInputBox}>
                        <Text style={styles.inputLabel}>Maintenance Notice Message</Text>
                        <TextInput
                          style={styles.textInput}
                          value={formState.platform.maintenanceNotice}
                          onChangeText={handleMaintenanceNoticeChange}
                          placeholder="Enter notice text displayed to users..."
                          placeholderTextColor={colors.textSecondary}
                          multiline
                        />
                      </View>
                    ) : null}

                    {/* Toggle: Allow New Registrations */}
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Allow Citizen Reporter Registrations</Text>
                        <Text style={styles.settingHint}>
                          Permits new public user onboarding to submit incident reports
                        </Text>
                      </View>
                      <Switch
                        value={formState.platform.allowNewRegistrations}
                        onValueChange={handleToggleRegistrations}
                        trackColor={{ false: colors.navy[100], true: colors.royal[700] }}
                        thumbColor={colors.surface}
                      />
                    </View>

                    {/* Selector Chips: Alert Threshold */}
                    <View style={[styles.settingColumnRow, styles.lastSettingRow]}>
                      <Text style={styles.settingLabel}>System Alert Severity Threshold</Text>
                      <Text style={styles.settingHint}>
                        Minimum security trigger level required to notify admins
                      </Text>
                      <View style={styles.chipsRow}>
                        {THRESHOLD_OPTIONS.map((opt) => {
                          const active = formState.platform.systemAlertThreshold === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => handleThresholdSelect(opt.id)}
                            >
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Section 4: Account Activation & User Management (AC 1, AC 2) */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionBadge, { backgroundColor: "#D1FAE5" }]}>
                        <AppIcon name="users" size={14} color={colors.success} />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>Account Activation & Access</Text>
                        <Text style={styles.sectionDescription}>
                          Manage active, inactive & suspended user states (JN-396)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sectionBody}>
                    <View style={styles.accountActionBox}>
                      <View style={styles.accountActionTextGroup}>
                        <Text style={styles.accountActionTitle}>User Management Hub</Text>
                        <Text style={styles.accountActionHint}>
                          View all registered staff and reporters. Toggle active status or suspend accounts with audit traceability.
                        </Text>
                      </View>

                      <Pressable
                        style={styles.openUsersBtn}
                        onPress={() => router.push("/admin/staff")}
                      >
                        <AppIcon name="users" size={14} color={colors.textInverse} />
                        <Text style={styles.openUsersBtnText}>Manage User Accounts</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Actions Footer */}
                <View style={styles.footerActions}>
                  <Pressable
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveChanges}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <>
                        <AppIcon name="check" size={16} color={colors.textInverse} />
                        <Text style={styles.saveButtonText}>Save Policy Changes</Text>
                      </>
                    )}
                  </Pressable>

                  {hasChanges ? (
                    <Pressable
                      style={styles.resetButton}
                      onPress={handleResetForm}
                      disabled={saving}
                    >
                      <Text style={styles.resetButtonText}>Discard Changes</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Sign Out Card */}
                <View style={styles.signOutCard}>
                  <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
                    <AppIcon name="log-out" size={16} color={colors.error} />
                    <Text style={styles.signOutBtnText}>Sign Out Administrator Session</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.navy[900],
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.navy[900],
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy[800],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.navy[800],
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.gold[300],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textInverse,
    marginTop: 1,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.navy[800],
    alignItems: "center",
    justifyContent: "center",
  },
  statusMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[200],
  },
  timestampText: {
    fontSize: 11,
    color: colors.navy[300],
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  unsavedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  unsavedBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  unsavedBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  saveQuickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  saveQuickBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#065F46",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
    lineHeight: 18,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: colors.navy[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy[900],
  },
  sectionDescription: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionBody: {
    padding: 16,
    gap: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingColumnRow: {
    gap: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastSettingRow: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[900],
  },
  settingHint: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  stepperBtn: {
    width: 32,
    height: 32,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  stepperValueBox: {
    paddingHorizontal: 10,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  stepperValueText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[900],
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.navy[50],
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
    fontWeight: "700",
  },
  noticeInputBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 6,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#92400E",
  },
  textInput: {
    fontSize: 12.5,
    color: colors.navy[900],
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
    minHeight: 48,
  },
  accountActionBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  accountActionTextGroup: {
    gap: 3,
  },
  accountActionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[900],
  },
  accountActionHint: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  openUsersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },
  openUsersBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  footerActions: {
    gap: 10,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textInverse,
  },
  resetButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.navy[100],
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  signOutCard: {
    marginTop: 10,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },
  unauthorizedContainer: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  unauthorizedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy[900],
  },
  unauthorizedMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  returnButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.royal[700],
  },
  returnButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
});