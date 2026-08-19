import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import {
  AuthScreen,
  ConfirmDialog,
  Notice,
  SettingsRow,
} from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { reporterLanguages } from "../registration/languages";
import { getReporterProfile } from "./getReporterProfile";
import { maskEmail, profileInitials, ReporterProfile } from "./types";

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ReporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setErrorMessage("");

    const result = await getReporterProfile();

    if (!result.ok) {
      if (result.reason === "unauthenticated" || result.reason === "forbidden") {
        await logoutReporter().catch(() => undefined);
        router.replace("/login");
        return;
      }

      setErrorMessage(result.message);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(result.profile);
    setLoading(false);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadProfile();
    }, [loadProfile])
  );

  const comingSoon = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} will be connected in a later Reporter module step.`
    );
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
      await logoutReporter();
      router.replace("/login");
    } catch {
      setShowLogoutConfirm(false);
      Alert.alert("Sign out failed", "We could not sign you out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const languageLabel =
    reporterLanguages.find(
      (item) => item.code === profile?.preferredLanguage
    )?.label ?? "English (English)";

  if (loading) {
    return (
      <AuthScreen title="Profile & settings" onBack={() => router.back()}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.royal[700]} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Profile & settings" onBack={() => router.replace("/reporter")}>
      {errorMessage ? (
        <Notice tone="error" title="Unable to load profile">
          {errorMessage}
        </Notice>
      ) : null}

      {profile ? (
        <>
          <View style={styles.identityCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profileInitials(profile.fullName || profile.email)}
              </Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{profile.fullName || "Reporter"}</Text>
              <Text style={styles.email}>{maskEmail(profile.email)}</Text>
              <View style={styles.verified}>
                <Text style={styles.verifiedText}>
                  ✓  Verified reporter account
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.group}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <SettingsRow
                icon="👤"
                label="Personal information"
                hint="Name, email and mobile number"
                onPress={() => router.push("/reporter/profile/personal")}
              />
              <SettingsRow
                icon="🌐"
                label="Language"
                value={languageLabel}
                onPress={() => router.push("/reporter/profile/personal")}
              />
              <SettingsRow
                icon="🔔"
                label="Notification preferences"
                hint="Discreet mode is on"
                last
                onPress={() => comingSoon("Notification preferences")}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy & security</Text>
              <SettingsRow
                icon="🔒"
                label="Privacy controls"
                hint="Who can see your identity and case data"
                onPress={() => comingSoon("Privacy controls")}
              />
              <SettingsRow
                icon="🛡"
                label="Security & sessions"
                hint="Password, two-factor, active devices"
                last
                onPress={() => comingSoon("Security & sessions")}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Help & legal</Text>
              <SettingsRow
                icon="?"
                label="Help & support"
                hint="Guides, FAQs and contact"
                onPress={() => comingSoon("Help & support")}
              />
              <SettingsRow
                icon="📄"
                label="Privacy policy"
                onPress={() => comingSoon("Privacy policy")}
              />
              <SettingsRow
                icon="📄"
                label="Terms of use"
                last
                onPress={() => comingSoon("Terms of use")}
              />
            </View>

            <View style={styles.section}>
              <SettingsRow
                icon="→"
                label="Sign out"
                danger
                last
                onPress={() => setShowLogoutConfirm(true)}
              />
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.noticeWrap}>
        <Notice tone="safety" title="Quick exit">
          Press and hold the back gesture twice to leave JusticeNow immediately
          and clear the screen.
        </Notice>
      </View>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Sign out of JusticeNow?"
        body="Your cases and drafts stay saved. You will need your password to sign back in."
        confirmLabel="Sign out"
        danger
        loading={loggingOut}
        onConfirm={handleLogout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[600],
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textInverse,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  email: {
    marginTop: 2,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  verified: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#EAF8F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.success,
  },
  group: {
    marginTop: 14,
    gap: 12,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  sectionTitle: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  noticeWrap: {
    marginTop: 14,
  },
});
