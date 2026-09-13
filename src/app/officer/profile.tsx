import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { colors, iconSizes } from "../../theme";

function initials(value?: string) {
  if (!value?.trim()) return "CO";

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function shortStaffId(value?: string) {
  if (!value) return "OFF-0000";
  return `OFF-${value.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export default function OfficerProfileRoute() {
  const router = useRouter();
  const { user, role, isLoading, signOut, refreshProfile } = useAuth();

  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!isLoading && (!user || role !== "case_officer")) {
      router.replace("/secure-role" as never);
    }
  }, [isLoading, role, router, user]);

  const displayName = user?.full_name?.trim() || "Case Officer";

  const metrics = useMemo(
    () => [
      { label: "Open", value: "—", hint: "Assigned", tone: "royal" },
      { label: "Resolved", value: "—", hint: "This month", tone: "teal" },
      { label: "Avg. days", value: "—", hint: "To contact", tone: "neutral" },
    ],
    [],
  );

  const unavailable = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} is not connected to a separate backend screen yet.`,
    );
  };

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      await signOut();
      setShowSignOut(false);
      router.replace("/login" as never);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please try again.";

      if (Platform.OS === "web") {
        window.alert(`Could not sign out: ${message}`);
      } else {
        Alert.alert("Could not sign out", message);
      }
    } finally {
      setSigningOut(false);
    }
  };

  if (isLoading || !user || role !== "case_officer") {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />
        <Text style={styles.loadingText}>Loading officer profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace("/officer" as never)}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <AppIcon
            name="chevron-left"
            size={iconSizes.headerBack}
            color={colors.navy[700]}
          />
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Officer profile</Text>
          <Text style={styles.headerSubtitle}>
            Account, security and preferences
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(displayName)}</Text>
          </View>

          <View style={styles.identityText}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>
              {user.email || "Staff email unavailable"}
            </Text>

            <View style={styles.unitBadge}>
              <AppIcon name="balance" size={12} color={colors.royal[700]} />
              <Text style={styles.unitBadgeText}>
                Human rights unit · {shortStaffId(user.id)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text
                style={[
                  styles.metricValue,
                  metric.tone === "teal" && styles.metricTeal,
                ]}
              >
                {metric.value}
              </Text>
              <Text style={styles.metricHint}>{metric.hint}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>

          <SettingsItem
            icon="user"
            label="Personal information"
            onPress={() => unavailable("Personal information")}
          />

          <SettingsItem
            icon="bell"
            label="Notification preferences"
            onPress={() => unavailable("Notification preferences")}
          />

          <SettingsItem
            icon="shield-check"
            label="Security & sessions"
            hint="Two-factor required"
            onPress={() => unavailable("Security & sessions")}
          />

          <SettingsItem
            icon="layout-dashboard"
            label="Dashboard"
            onPress={() => router.replace("/officer" as never)}
            last
          />
        </View>

        <View style={styles.signOutCard}>
          <SettingsItem
            icon="log-out"
            label="Sign out"
            danger
            onPress={() => setShowSignOut(true)}
            last
          />
        </View>

        <View style={styles.notice}>
          <AppIcon name="shield-alert" size={17} color={colors.warning} />

          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>Duty of care</Text>
            <Text style={styles.noticeBody}>
              Case content is confidential. Discussing identifiable details
              outside JusticeNow may put a reporter at risk.
            </Text>
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showSignOut}
        title="Sign out?"
        body="Open case notes are saved automatically. You will need staff credentials and MFA to sign back in."
        confirmLabel="Sign out"
        danger
        loading={signingOut}
        onConfirm={() => void handleSignOut()}
        onClose={() => setShowSignOut(false)}
      />
    </SafeAreaView>
  );
}

function SettingsItem({
  icon,
  label,
  hint,
  danger = false,
  last = false,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  hint?: string;
  danger?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.settingsRow,
        !last && styles.settingsBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.settingsIcon, danger && styles.settingsIconDanger]}>
        <AppIcon
          name={icon}
          size={17}
          color={danger ? colors.error : colors.royal[700]}
        />
      </View>

      <View style={styles.settingsText}>
        <Text style={[styles.settingsLabel, danger && styles.dangerText]}>
          {label}
        </Text>
        {hint ? <Text style={styles.settingsHint}>{hint}</Text> : null}
      </View>

      <AppIcon name="chevron-right" size={17} color={colors.textSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.navy[800],
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 34,
  },
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.navy[800],
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textInverse,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.navy[800],
  },
  email: {
    marginTop: 2,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  unitBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: colors.royal[50],
  },
  unitBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  metricValue: {
    marginTop: 7,
    fontSize: 19,
    fontWeight: "600",
    color: colors.royal[700],
  },
  metricTeal: {
    color: colors.teal[700],
  },
  metricHint: {
    marginTop: 3,
    fontSize: 10.5,
    color: colors.textSoft,
  },
  sectionCard: {
    overflow: "hidden",
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  signOutCard: {
    overflow: "hidden",
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  settingsRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  settingsBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },
  settingsIconDanger: {
    backgroundColor: "#FFF0EF",
  },
  settingsText: {
    flex: 1,
    minWidth: 0,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  settingsHint: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  dangerText: {
    color: colors.error,
  },
  pressed: {
    opacity: 0.72,
  },
  notice: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gold[100],
    borderRadius: 16,
    backgroundColor: colors.gold[50],
  },
  noticeText: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  noticeBody: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
