import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardRouteForRole, getRoleConfig, useAuth } from "../auth";
import { colors } from "../theme";

export default function UnauthorizedAccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reason?: string; target?: string }>();
  const { role, user, signOut } = useAuth();

  const isInactive = params.reason === "inactive";
  const targetRoute = role ? getDashboardRouteForRole(role) : null;
  const currentRoleConfig = role ? getRoleConfig(role) : null;

  const handleGoToMyDashboard = () => {
    if (targetRoute) {
      router.replace(targetRoute as any);
    } else {
      router.replace("/login");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Ignore signOut failures in offline mode
    } finally {
      router.replace("/login");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Branding */}
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/justicenow-logo-mark.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="JusticeNow logo"
          />
          <Text style={styles.brandTitle}>
            Justice<Text style={styles.brandAccent}>Now</Text> Security
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View
            style={[
              styles.iconCircle,
              isInactive ? styles.iconInactive : styles.iconUnauthorized,
            ]}
          >
            <Text style={styles.icon}>{isInactive ? "⚠️" : "🔒"}</Text>
          </View>

          <Text style={styles.title}>
            {isInactive ? "Account Inactive" : "Access Restricted"}
          </Text>

          <Text style={styles.message}>
            {isInactive
              ? "Your account or assigned role is currently inactive or suspended. Please contact your system administrator to reactivate your credentials."
              : "You do not have authorization to view this section. JusticeNow enforces strict role-based access control to protect human-rights data and chain of custody."}
          </Text>

          {/* User Session Info */}
          {role && (
            <View style={styles.roleInfoCard}>
              <Text style={styles.roleInfoLabel}>Current Signed In Profile:</Text>
              <View style={styles.roleBadgeRow}>
                <Text style={styles.roleBadgeIcon}>
                  {currentRoleConfig?.icon || "👤"}
                </Text>
                <View>
                  <Text style={styles.roleBadgeName}>
                    {user?.full_name || currentRoleConfig?.name || role}
                  </Text>
                  <Text style={styles.roleBadgeSubtitle}>
                    Role: {currentRoleConfig?.label || role}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            {targetRoute && !isInactive ? (
              <Pressable
                style={styles.primaryButton}
                onPress={handleGoToMyDashboard}
                accessibilityRole="button"
                accessibilityLabel="Go to my authorized dashboard"
              >
                <Text style={styles.primaryButtonText}>
                  Go to My Dashboard ({currentRoleConfig?.name || "Home"})
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.secondaryButton,
                !targetRoute || isInactive ? styles.primaryButton : null,
              ]}
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out and return to login"
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  !targetRoute || isInactive ? styles.primaryButtonText : null,
                ]}
              >
                Sign Out & Return to Login
              </Text>
            </Pressable>

            <Pressable
              style={styles.staffLinkButton}
              onPress={() => router.push("/secure-role")}
              accessibilityRole="button"
            >
              <Text style={styles.staffLinkText}>
                Switch Staff Role / Admin Access
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Security Help Notice */}
        <View style={styles.securityNotice}>
          <Text style={styles.securityNoticeText}>
            🛡️ Need access? If you believe this is in error, contact the system administrator at{" "}
            <Text style={styles.contactEmail}>admin@justicenow.org</Text>.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },
  brandAccent: {
    color: colors.teal[600],
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconUnauthorized: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  iconInactive: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  icon: {
    fontSize: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navy[900],
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  roleInfoCard: {
    width: "100%",
    backgroundColor: colors.navy[50],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.navy[100],
    marginBottom: 20,
  },
  roleInfoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[600],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  roleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleBadgeIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  roleBadgeName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[900],
  },
  roleBadgeSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  actionContainer: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    width: "100%",
    minHeight: 48,
    backgroundColor: colors.royal[700],
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textInverse,
    textAlign: "center",
  },
  secondaryButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  staffLinkButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  staffLinkText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
  securityNotice: {
    marginTop: 20,
    maxWidth: 440,
    paddingHorizontal: 8,
  },
  securityNoticeText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSoft,
    textAlign: "center",
  },
  contactEmail: {
    color: colors.royal[700],
    fontWeight: "600",
  },
});
