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

import { ConfirmDialog } from "../../components/common";
import { supabase } from "../../lib/supabase";
import { logoutReporter } from "../../reporter/login";
import { colors } from "../../theme";

export default function ReporterDashboard() {
  const router = useRouter();

  const [name, setName] = useState("Reporter");

  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // -------------------------------------------------------
  // Load User
  // -------------------------------------------------------

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Dashboard profile error:", error);

        return;
      }

      if (profile?.role !== "reporter") {
        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      if (profile.full_name) {
        setName(profile.full_name);
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Logout
  // -------------------------------------------------------

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
      await logoutReporter();
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setShowLogoutConfirm(false);
      Alert.alert(
        "Sign out failed",
        "We could not sign you out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  // -------------------------------------------------------
  // Placeholder Actions
  // -------------------------------------------------------

  const comingSoon = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} will be connected in the next Reporter module step.`,
    );
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading JusticeNow...</Text>
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
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>
              Justice
              <Text style={styles.brandNow}>Now</Text>
            </Text>

            <Text style={styles.headerSubtitle}>
              Human Rights Case Tracking
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/reporter/profile")}
              style={styles.logoutButton}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
            >
              <Text style={styles.logoutText}>Profile</Text>
            </Pressable>
            <Pressable onPress={() => setShowLogoutConfirm(true)} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        {/* Welcome */}

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>Welcome back</Text>

          <Text style={styles.welcomeName}>{name}</Text>

          <Text style={styles.welcomeText}>
            Report human rights concerns safely, monitor your cases and access
            trusted support.
          </Text>
        </View>

        {/* Primary Action */}

        <Pressable
          onPress={() => comingSoon("Report a Case")}
          style={styles.reportButton}
        >
          <View style={styles.reportIcon}>
            <Text style={styles.reportIconText}>+</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Report a Case</Text>

            <Text style={styles.reportDescription}>
              Submit a new human rights complaint securely.
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* Section */}

        <Text style={styles.sectionTitle}>Your JusticeNow</Text>

        {/* My Cases */}

        <Pressable onPress={() => comingSoon("My Cases")} style={styles.card}>
          <View style={styles.cardIconBlue}>
            <Text style={styles.cardIconText}>📄</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>My Cases</Text>

            <Text style={styles.cardDescription}>
              View submitted cases, updates and investigation progress.
            </Text>
          </View>

          <Text style={styles.cardArrow}>›</Text>
        </Pressable>

        {/* Support */}

        <Pressable
          onPress={() => comingSoon("Support Services")}
          style={styles.card}
        >
          <View style={styles.cardIconTeal}>
            <Text style={styles.cardIconText}>🤝</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Support Services</Text>

            <Text style={styles.cardDescription}>
              Find legal, counselling and emergency support.
            </Text>
          </View>

          <Text style={styles.cardArrow}>›</Text>
        </Pressable>

        {/* Rights */}

        <Pressable
          onPress={() => comingSoon("Know Your Rights")}
          style={styles.card}
        >
          <View style={styles.cardIconGold}>
            <Text style={styles.cardIconText}>⚖️</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Know Your Rights</Text>

            <Text style={styles.cardDescription}>
              Access simple information about human rights and available
              protections.
            </Text>
          </View>

          <Text style={styles.cardArrow}>›</Text>
        </Pressable>

        {/* Security */}

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Your privacy matters</Text>

            <Text style={styles.securityText}>
              JusticeNow protects your account and case information using secure
              authentication and controlled access.
            </Text>
          </View>
        </View>
      </ScrollView>

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

    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: 20,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  brand: {
    fontSize: 22,

    fontWeight: "800",

    color: colors.navy[800],
  },

  brandNow: {
    color: colors.royal[600],
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  logoutButton: {
    minHeight: 40,

    paddingHorizontal: 14,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  logoutText: {
    fontSize: 12.5,

    fontWeight: "600",

    color: colors.navy[700],
  },

  // -----------------------------------------------------
  // Welcome
  // -----------------------------------------------------

  welcomeCard: {
    padding: 20,

    borderRadius: 18,

    backgroundColor: colors.navy[800],
  },

  welcomeLabel: {
    fontSize: 12,

    color: "#C8D4E4",
  },

  welcomeName: {
    marginTop: 3,

    fontSize: 23,

    fontWeight: "800",

    color: colors.textInverse,
  },

  welcomeText: {
    marginTop: 8,

    maxWidth: 310,

    fontSize: 13,

    lineHeight: 19,

    color: "#DDE6F0",
  },

  // -----------------------------------------------------
  // Report
  // -----------------------------------------------------

  reportButton: {
    marginTop: 16,

    minHeight: 82,

    flexDirection: "row",

    alignItems: "center",

    padding: 16,

    borderRadius: 16,

    backgroundColor: colors.royal[700],
  },

  reportIcon: {
    width: 42,
    height: 42,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: "rgba(255,255,255,0.16)",
  },

  reportIconText: {
    fontSize: 27,

    fontWeight: "300",

    color: colors.textInverse,
  },

  reportTitle: {
    fontSize: 16,

    fontWeight: "700",

    color: colors.textInverse,
  },

  reportDescription: {
    marginTop: 3,

    fontSize: 11.5,

    lineHeight: 16,

    color: "#DCE7FF",
  },

  arrow: {
    marginLeft: 8,

    fontSize: 30,

    color: colors.textInverse,
  },

  // -----------------------------------------------------
  // Cards
  // -----------------------------------------------------

  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,

    fontSize: 16,

    fontWeight: "700",

    color: colors.navy[800],
  },

  card: {
    minHeight: 82,

    flexDirection: "row",

    alignItems: "center",

    marginBottom: 10,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  cardContent: {
    flex: 1,
  },

  cardIconBlue: {
    width: 44,
    height: 44,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  cardIconTeal: {
    width: 44,
    height: 44,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.teal[50],
  },

  cardIconGold: {
    width: 44,
    height: 44,

    marginRight: 12,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.gold[50],
  },

  cardIconText: {
    fontSize: 20,
  },

  cardTitle: {
    fontSize: 14,

    fontWeight: "700",

    color: colors.navy[800],
  },

  cardDescription: {
    marginTop: 3,

    fontSize: 11.5,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  cardArrow: {
    marginLeft: 8,

    fontSize: 27,

    color: colors.navy[400],
  },

  // -----------------------------------------------------
  // Security
  // -----------------------------------------------------

  securityNotice: {
    flexDirection: "row",

    marginTop: 10,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 14,

    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 10,

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
