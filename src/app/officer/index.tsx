import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

export default function OfficerDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [officerName, setOfficerName] = useState("Case Officer");

  // -------------------------------------------------------
  // Load and validate officer
  // -------------------------------------------------------

  useEffect(() => {
    loadOfficer();
  }, []);

  const loadOfficer = async () => {
    try {
      setLoading(true);

      // Get currently authenticated Supabase user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.log("Officer authentication error:", userError);

        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      console.log("OFFICER USER:", user.id);

      // Load JusticeNow profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Officer profile error:", profileError);

        Alert.alert(
          "Profile error",
          "JusticeNow could not load your staff profile.",
        );

        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      if (!profile || profile.role !== "case_officer") {
        console.log("Unauthorized officer access:", profile?.role);

        Alert.alert(
          "Access denied",
          "This area is available only to authorized Case Officers.",
        );

        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      // Use officer full name
      if (profile.full_name && profile.full_name.trim() !== "") {
        setOfficerName(profile.full_name);
      }

      console.log("CASE OFFICER VERIFIED:", profile);
    } catch (error) {
      console.error("Officer dashboard error:", error);

      Alert.alert(
        "Connection error",
        "JusticeNow could not verify your staff account.",
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Sign Out
  // -------------------------------------------------------

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of JusticeNow?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign out",
          style: "destructive",

          onPress: async () => {
            await supabase.auth.signOut();

            router.replace("/login");
          },
        },
      ],
    );
  };

  // -------------------------------------------------------
  // Temporary actions
  // -------------------------------------------------------

  const showComingSoon = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} will be connected in the next Case Officer implementation step.`,
    );
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading officer workspace...</Text>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>
              Justice
              <Text style={styles.brandNow}>Now</Text>
            </Text>

            <Text style={styles.roleText}>Case Officer Workspace</Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        {/* Welcome */}

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>Welcome back</Text>

          <Text style={styles.welcomeName}>{officerName}</Text>

          <Text style={styles.welcomeDescription}>
            Review assigned cases, investigate reported incidents, manage
            evidence and keep case progress up to date.
          </Text>
        </View>

        {/* Overview */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Case overview</Text>

          <Text style={styles.sectionSubtitle}>Your current workload</Text>
        </View>

        {/* Statistics */}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>

            <Text style={styles.statLabel}>Assigned</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>

            <Text style={styles.statLabel}>In progress</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>—</Text>

            <Text style={styles.statLabel}>Priority</Text>
          </View>
        </View>

        <Text style={styles.statHint}>
          Live case statistics will appear after the cases database is
          connected.
        </Text>

        {/* Assigned Cases */}

        <Text style={styles.sectionTitleStandalone}>Workspace</Text>

        <Pressable
          onPress={() => router.push("/officer/cases")}
          accessibilityRole="button"
          accessibilityLabel="View assigned cases"
          style={styles.primaryAction}
        >
          <View style={styles.primaryIconBox}>
            <Text style={styles.primaryIcon}>📁</Text>
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.primaryActionTitle}>Assigned Cases</Text>

            <Text style={styles.primaryActionText}>
              View cases assigned to you and continue active investigations.
            </Text>
          </View>

          <Text style={styles.primaryArrow}>›</Text>
        </Pressable>

        {/* Evidence */}

        <Pressable
          onPress={() => router.push("/officer/evidence")}
          accessibilityRole="button"
          style={styles.actionCard}
        >
          <View style={styles.blueIconBox}>
            <Text style={styles.actionIcon}>🔎</Text>
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Evidence Review</Text>

            <Text style={styles.actionText}>
              Review evidence attached to cases and record your investigation
              findings.
            </Text>
          </View>

          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        {/* Status Updates */}

        <Pressable
          onPress={() => showComingSoon("Case Updates")}
          accessibilityRole="button"
          style={styles.actionCard}
        >
          <View style={styles.tealIconBox}>
            <Text style={styles.actionIcon}>✓</Text>
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Case Updates</Text>

            <Text style={styles.actionText}>
              Record progress and update the investigation status of assigned
              cases.
            </Text>
          </View>

          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        {/* Notifications */}

        <Pressable
          onPress={() => showComingSoon("Notifications")}
          accessibilityRole="button"
          style={styles.actionCard}
        >
          <View style={styles.goldIconBox}>
            <Text style={styles.actionIcon}>🔔</Text>
          </View>

          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Notifications</Text>

            <Text style={styles.actionText}>
              View assignment alerts, evidence updates and case activity.
            </Text>
          </View>

          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        {/* Security */}

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Restricted workspace</Text>

            <Text style={styles.securityText}>
              Case information is confidential. Access only cases required for
              your assigned investigation duties.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

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

  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },

  // -------------------------------------------------------
  // Header
  // -------------------------------------------------------

  header: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 18,
  },

  headerLeft: {
    flex: 1,
  },

  brand: {
    fontSize: 23,
    fontWeight: "800",

    color: colors.navy[800],
  },

  brandNow: {
    color: colors.royal[600],
  },

  roleText: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  signOutButton: {
    minHeight: 40,

    paddingHorizontal: 14,

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  signOutText: {
    fontSize: 12.5,
    fontWeight: "600",

    color: colors.navy[700],
  },

  // -------------------------------------------------------
  // Welcome
  // -------------------------------------------------------

  welcomeCard: {
    padding: 20,

    borderRadius: 18,

    backgroundColor: colors.navy[800],
  },

  welcomeLabel: {
    fontSize: 12,

    color: "#BED0E5",
  },

  welcomeName: {
    marginTop: 3,

    fontSize: 23,
    fontWeight: "800",

    color: colors.textInverse,
  },

  welcomeDescription: {
    marginTop: 8,

    fontSize: 13,
    lineHeight: 19,

    color: "#DCE5EF",
  },

  // -------------------------------------------------------
  // Section
  // -------------------------------------------------------

  sectionHeader: {
    marginTop: 25,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",

    color: colors.navy[800],
  },

  sectionSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  sectionTitleStandalone: {
    marginTop: 24,
    marginBottom: 10,

    fontSize: 16,
    fontWeight: "700",

    color: colors.navy[800],
  },

  // -------------------------------------------------------
  // Stats
  // -------------------------------------------------------

  statsRow: {
    flexDirection: "row",

    gap: 8,
  },

  statCard: {
    flex: 1,

    minHeight: 88,

    padding: 12,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  statNumber: {
    fontSize: 22,
    fontWeight: "800",

    color: colors.navy[800],
  },

  statLabel: {
    marginTop: 4,

    textAlign: "center",

    fontSize: 11,

    color: colors.textSecondary,
  },

  statHint: {
    marginTop: 8,

    fontSize: 10.5,
    lineHeight: 15,

    color: colors.textSoft,
  },

  // -------------------------------------------------------
  // Primary Action
  // -------------------------------------------------------

  primaryAction: {
    minHeight: 92,

    flexDirection: "row",
    alignItems: "center",

    padding: 15,

    borderRadius: 16,

    backgroundColor: colors.royal[700],
  },

  primaryIconBox: {
    width: 46,
    height: 46,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 13,

    backgroundColor: "rgba(255,255,255,0.15)",
  },

  primaryIcon: {
    fontSize: 20,
  },

  primaryActionTitle: {
    fontSize: 15,
    fontWeight: "700",

    color: colors.textInverse,
  },

  primaryActionText: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 16,

    color: "#DCE7FF",
  },

  primaryArrow: {
    marginLeft: 8,

    fontSize: 28,

    color: colors.textInverse,
  },

  // -------------------------------------------------------
  // Action Cards
  // -------------------------------------------------------

  actionCard: {
    minHeight: 86,

    flexDirection: "row",
    alignItems: "center",

    marginTop: 10,

    padding: 14,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  actionContent: {
    flex: 1,
  },

  blueIconBox: {
    width: 44,
    height: 44,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  tealIconBox: {
    width: 44,
    height: 44,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.teal[50],
  },

  goldIconBox: {
    width: 44,
    height: 44,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.gold[50],
  },

  actionIcon: {
    fontSize: 18,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: "700",

    color: colors.navy[800],
  },

  actionText: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 16,

    color: colors.textSecondary,
  },

  actionArrow: {
    marginLeft: 8,

    fontSize: 27,

    color: colors.navy[400],
  },

  // -------------------------------------------------------
  // Security
  // -------------------------------------------------------

  securityNotice: {
    flexDirection: "row",

    marginTop: 18,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 14,

    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 9,

    fontSize: 16,
  },

  securityTitle: {
    fontSize: 12.5,
    fontWeight: "700",

    color: colors.teal[800],
  },

  securityText: {
    marginTop: 3,

    fontSize: 11.5,
    lineHeight: 17,

    color: colors.textSecondary,
  },
});
