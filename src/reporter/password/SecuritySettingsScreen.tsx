import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import {
  AuthScreen,
  Notice,
  PrimaryButton,
  SectionCard,
} from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { getReporterProfile } from "../profile/getReporterProfile";

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const guard = async () => {
        const result = await getReporterProfile();

        if (!active) {
          return;
        }

        if (
          !result.ok &&
          (result.reason === "unauthenticated" || result.reason === "forbidden")
        ) {
          await logoutReporter().catch(() => undefined);
          router.replace("/login");
          return;
        }

        setReady(true);
      };

      void guard();

      return () => {
        active = false;
      };
    }, [router])
  );

  const comingSoon = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} will be connected in a later Reporter module step.`
    );
  };

  if (!ready) {
    return (
      <AuthScreen
        title="Security & sessions"
        onBack={() => router.back()}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.royal[700]} />
          <Text style={styles.loadingText}>Loading security settings...</Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Security & sessions"
      onBack={() => router.back()}
    >
      <View style={styles.stack}>
        <SectionCard title="Password">
          <Text style={styles.muted}>
            Change your password to keep your JusticeNow account secure.
          </Text>
          <View style={styles.buttonWrap}>
            <PrimaryButton
              title="Change password"
              variant="outline"
              onPress={() => router.push("/reporter/profile/change-password")}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Two-factor authentication"
          action={<Text style={styles.badge}>On</Text>}
        >
          <Text style={styles.muted}>
            Authenticator app codes refresh every 30 seconds. SMS backup codes
            are used only if you lose access to the app.
          </Text>
          <View style={styles.buttonWrap}>
            <PrimaryButton
              title="View recovery codes"
              variant="outline"
              onPress={() => comingSoon("Two-factor recovery codes")}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Active sessions"
          description="Devices currently signed in to your account."
        >
          <Text style={styles.muted}>
            Session management will be connected in a later step. Changing your
            password signs out other devices.
          </Text>
          <View style={styles.buttonWrap}>
            <PrimaryButton
              title="Sign out of all other devices"
              variant="destructive"
              onPress={() => comingSoon("Sign out of all other devices")}
            />
          </View>
        </SectionCard>
      </View>

      <View style={styles.noticeWrap}>
        <Notice tone="caution" title="If you think someone else has access">
          Change your password, sign out of all devices and tell your case
          officer through a secure message.
        </Notice>
      </View>
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
  stack: {
    gap: 12,
  },
  muted: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  buttonWrap: {
    marginTop: 10,
  },
  badge: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
    backgroundColor: "#EAF8F2",
  },
  noticeWrap: {
    marginTop: 14,
  },
});
