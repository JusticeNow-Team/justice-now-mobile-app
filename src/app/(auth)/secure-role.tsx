import { useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

export default function SecureRoleScreen() {
  const router = useRouter();

  const continueToVerification = () => {
    router.push("/two-factor");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Staff access
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>🛡️</Text>
          </View>

          <Text style={styles.title}>
            Secure JusticeNow staff access
          </Text>

          <Text style={styles.description}>
            Staff accounts use additional verification
            because they may access sensitive reports,
            evidence and investigation information.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Staff roles
          </Text>

          <RoleItem
            icon="⚖️"
            title="Case Investigator / Officer"
            description="Reviews and investigates assigned human-rights cases."
          />

          <View style={styles.divider} />

          <RoleItem
            icon="🔍"
            title="Evidence Checker / Validator"
            description="Reviews submitted evidence and records validation decisions."
          />

          <View style={styles.divider} />

          <RoleItem
            icon="⚙️"
            title="System Administrator"
            description="Manages accounts, permissions, security and system configuration."
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Roles are assigned by JusticeNow
            </Text>

            <Text style={styles.infoText}>
              You cannot choose or change a staff role
              during sign-in. Your permissions are loaded
              securely from your approved account after
              authentication.
            </Text>
          </View>
        </View>

        <View style={styles.securityCard}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={styles.infoContent}>
            <Text style={styles.securityTitle}>
              Protected access
            </Text>

            <Text style={styles.securityText}>
              Staff access requires identity verification,
              two-factor authentication and role-based
              authorization.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={continueToVerification}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>
            Continue to verification
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/login")}
          accessibilityRole="button"
          style={styles.reporterButton}
        >
          <Text style={styles.reporterText}>
            Return to regular sign in
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function RoleItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.roleRow}>
      <View style={styles.roleIcon}>
        <Text>{icon}</Text>
      </View>

      <View style={styles.roleContent}>
        <Text style={styles.roleTitle}>
          {title}
        </Text>

        <Text style={styles.roleDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 62,
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

  backText: {
    fontSize: 32,
    color: colors.navy[700],
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },

  content: {
    flex: 1,
    padding: 16,
  },

  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  iconBox: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.royal[50],
  },

  icon: {
    fontSize: 27,
  },

  title: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },

  description: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  cardTitle: {
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },

  roleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  roleIcon: {
    width: 42,
    height: 42,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },

  roleContent: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },

  roleDescription: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  divider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: colors.border,
  },

  infoCard: {
    marginTop: 14,
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 14,
    backgroundColor: colors.royal[50],
  },

  infoIcon: {
    marginRight: 9,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.royal[800],
  },

  infoText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  securityCard: {
    marginTop: 10,
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 9,
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
    color: colors.teal[800],
  },

  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },

  pressed: {
    opacity: 0.88,
  },

  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },

  reporterButton: {
    minHeight: 42,
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  reporterText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.royal[700],
  },
});