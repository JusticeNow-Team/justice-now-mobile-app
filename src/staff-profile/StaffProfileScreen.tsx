import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "../auth";
import { AppIcon, AppIconName } from "../components/AppIcon";
import {
  AuthScreen,
  ConfirmDialog,
  Notice,
  SettingsRow,
} from "../components/common";
import { colors } from "../theme";

type StaffProfileRole = "case_officer" | "evidence_checker";

interface StaffProfileScreenProps {
  role: StaffProfileRole;
}

interface ProfileConfig {
  title: string;
  roleLabel: string;
  description: string;
  icon: AppIconName;
  accent: string;
  accentSoft: string;
  dashboardRoute: "/officer" | "/validator/dashboard";
}

const PROFILE_CONFIG: Record<StaffProfileRole, ProfileConfig> = {
  case_officer: {
    title: "Officer profile",
    roleLabel: "Case Officer",
    description: "Authorized case-management staff",
    icon: "scale",
    accent: colors.royal[700],
    accentSoft: colors.royal[50],
    dashboardRoute: "/officer",
  },
  evidence_checker: {
    title: "Validator profile",
    roleLabel: "Evidence Validator",
    description: "Authorized evidence-review staff",
    icon: "clipboard-check",
    accent: colors.teal[700],
    accentSoft: colors.teal[50],
    dashboardRoute: "/validator/dashboard",
  },
};

function initials(value?: string) {
  if (!value?.trim()) return "JN";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function shortStaffId(value?: string) {
  if (!value) return "Not available";

  return value.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function ProfileMetric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function PreferenceToggle({
  icon,
  label,
  hint,
  value,
  onValueChange,
  last = false,
}: {
  icon: AppIconName;
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !last && styles.rowBorder]}>
      <View style={styles.toggleIcon}>
        <AppIcon name={icon} size={16} color={colors.teal[700]} />
      </View>

      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>

      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.navy[100],
          true: colors.teal[200],
        }}
        thumbColor={value ? colors.teal[700] : colors.surface}
      />
    </View>
  );
}

export default function StaffProfileScreen({
  role: expectedRole,
}: StaffProfileScreenProps) {
  const router = useRouter();

  const {
    user,
    role,
    isLoading,
    signOut,
    refreshProfile,
  } = useAuth();

  const config = PROFILE_CONFIG[expectedRole];

  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [blurPreviews, setBlurPreviews] = useState(true);
  const [muteAudio, setMuteAudio] = useState(false);
  const [breakReminder, setBreakReminder] = useState(true);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!isLoading && (!user || role !== expectedRole)) {
      router.replace("/secure-role" as never);
    }
  }, [expectedRole, isLoading, role, router, user]);

  const displayName =
    user?.full_name?.trim() || config.roleLabel;

  const accountStatus =
    user?.is_active === false ? "Inactive" : "Active";

  const metrics = useMemo(
    () => [
      {
        label: "Account",
        value: accountStatus,
        hint: "Staff access",
      },
      {
        label: "MFA",
        value: "Required",
        hint: "Protected",
      },
      {
        label: "Access",
        value:
          expectedRole === "case_officer"
            ? "Officer"
            : "Validator",
        hint: "Role based",
      },
    ],
    [accountStatus, expectedRole]
  );

  const showNotConnected = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} is not connected to a separate backend screen in the Sprint 2 build.`
    );
  };

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      await signOut();
      setShowSignOut(false);
      router.replace("/login" as never);
    } catch (error) {
      Alert.alert(
        "Could not sign out",
        error instanceof Error
          ? error.message
          : "Please try again."
      );
    } finally {
      setSigningOut(false);
    }
  };

  if (isLoading || !user || role !== expectedRole) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={config.accent}
        />

        <Text style={styles.loadingText}>
          Loading secure profile…
        </Text>
      </View>
    );
  }

  return (
    <AuthScreen
      title={config.title}
      subtitle="Account, security and preferences"
      onBack={() =>
        router.replace(config.dashboardRoute as never)
      }
    >
      <View style={styles.identityCard}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: config.accentSoft },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: config.accent },
            ]}
          >
            {initials(displayName)}
          </Text>
        </View>

        <View style={styles.identityText}>
          <Text style={styles.name}>
            {displayName}
          </Text>

          <Text style={styles.email}>
            {user.email || "Staff email unavailable"}
          </Text>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: config.accentSoft },
              ]}
            >
              <AppIcon
                name={config.icon}
                size={13}
                color={config.accent}
              />

              <Text
                style={[
                  styles.roleBadgeText,
                  { color: config.accent },
                ]}
              >
                {config.roleLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>
            {config.description}
          </Text>

          <Text style={styles.staffId}>
            Staff ID · {shortStaffId(user.id)}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {metrics.map((metric) => (
          <ProfileMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            accent={config.accent}
          />
        ))}
      </View>

      {expectedRole === "evidence_checker" ? (
        <>
          <Text style={styles.sectionTitle}>
            Wellbeing settings
          </Text>

          <View style={styles.sectionCard}>
            <PreferenceToggle
              icon="eye-off"
              label="Blur sensitive previews"
              hint="Hide graphic thumbnails until opened"
              value={blurPreviews}
              onValueChange={setBlurPreviews}
            />

            <PreferenceToggle
              icon="mic"
              label="Mute media by default"
              hint="Start audio and video evidence muted"
              value={muteAudio}
              onValueChange={setMuteAudio}
            />

            <PreferenceToggle
              icon="clock"
              label="Break reminders"
              hint="Show a reminder during long review sessions"
              value={breakReminder}
              onValueChange={setBreakReminder}
              last
            />
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>
        Account & security
      </Text>

      <View style={styles.sectionCard}>
        <SettingsRow
          icon="user"
          label="Personal information"
          hint="Name, staff ID and contact details"
          onPress={() =>
            showNotConnected("Personal information")
          }
        />

        <SettingsRow
          icon="bell"
          label="Notification preferences"
          hint="Case and evidence activity alerts"
          onPress={() =>
            showNotConnected("Notification preferences")
          }
        />

        <SettingsRow
          icon="shield-check"
          label="Security & sessions"
          hint="Multi-factor authentication is required"
          value="Protected"
          onPress={() =>
            showNotConnected("Security & sessions")
          }
        />

        <SettingsRow
          icon="log-out"
          label="Sign out"
          hint="End this secure staff session"
          danger
          last
          onPress={() => setShowSignOut(true)}
        />
      </View>

      <View style={styles.noticeWrap}>
        <Notice
          tone={
            expectedRole === "evidence_checker"
              ? "safety"
              : "privacy"
          }
          title="Duty of care"
        >
          {expectedRole === "evidence_checker"
            ? "Use wellbeing controls when reviewing distressing material. Take a break whenever needed."
            : "Only access cases needed for your assigned work. All staff activity is recorded for accountability."}
        </Notice>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh profile"
        onPress={() => void refreshProfile()}
        style={({ pressed }) => [
          styles.refreshButton,
          pressed && styles.pressed,
        ]}
      >
        <AppIcon
          name="refresh-cw"
          size={15}
          color={colors.navy[600]}
        />

        <Text style={styles.refreshText}>
          Refresh profile
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={showSignOut}
        title="Sign out of JusticeNow?"
        body="You will need your staff credentials and MFA verification to sign in again."
        confirmLabel="Sign out"
        danger
        loading={signingOut}
        onConfirm={() => void handleSignOut()}
        onClose={() => setShowSignOut(false)}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background,
  },

  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  identityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.surface,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 19,
    fontWeight: "800",
  },

  identityText: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy[900],
  },

  email: {
    marginTop: 3,
    fontSize: 12.5,
    color: colors.textSecondary,
  },

  badgeRow: {
    marginTop: 10,
    flexDirection: "row",
  },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  description: {
    marginTop: 9,
    fontSize: 12,
    color: colors.navy[600],
  },

  staffId: {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSoft,
  },

  metricsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },

  metricCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },

  metricLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.45,
    color: colors.textSoft,
  },

  metricValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "800",
  },

  metricHint: {
    marginTop: 2,
    fontSize: 10.5,
    color: colors.textSecondary,
  },

  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 2,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.navy[700],
  },

  sectionCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  toggleRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },

  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.7)",
  },

  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.teal[50],
  },

  toggleText: {
    flex: 1,
    minWidth: 0,
  },

  toggleLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },

  toggleHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  noticeWrap: {
    marginTop: 16,
  },

  refreshButton: {
    minHeight: 42,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
  },

  refreshText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[600],
  },

  pressed: {
    opacity: 0.65,
  },
});