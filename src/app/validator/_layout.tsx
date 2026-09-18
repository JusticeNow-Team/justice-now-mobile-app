import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { hasCompletedStaffMfa } from "../../auth";
import { supabase } from "../../lib/supabase";
import RoleBottomNavigation from "../../navigation/RoleBottomNavigation";
import { colors } from "../../theme";

export default function ValidatorLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verifyValidatorAccess = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/secure-role");
          return;
        }

        const mfa = await hasCompletedStaffMfa();

        if (mfa.error) {
          throw mfa.error;
        }

        if (!mfa.verified) {
          router.replace("/two-factor");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", user.id)
          .single();

        if (
          profileError ||
          profile?.role !== "evidence_validator" ||
          !profile.is_active
        ) {
          await supabase.auth.signOut();
          router.replace("/secure-role");
          return;
        }

        if (mounted) {
          setReady(true);
        }
      } catch (error) {
        console.error("VALIDATOR ACCESS CHECK ERROR:", error);

        await supabase.auth.signOut();
        router.replace("/secure-role");
      }
    };

    void verifyValidatorAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>
          Opening secure validator workspace...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.workspace}>
      <View style={styles.screenContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        />
      </View>

      <RoleBottomNavigation role="evidence_validator" />
    </View>
  );
}

const styles = StyleSheet.create({
  workspace: {
    flex: 1,
    backgroundColor: colors.background,
  },

  screenContainer: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
