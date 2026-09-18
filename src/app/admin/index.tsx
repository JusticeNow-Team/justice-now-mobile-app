import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../auth";
import { AppIcon } from "../../components/AppIcon";
import {
  getStaffAccounts,
  getStaffAuditLogs,
  StaffAccount,
  StaffAuditLog,
} from "../../staff";
import { colors } from "../../theme";

type Tone = "info" | "ok" | "warn" | "danger";

const systemHealth = [
  {
    label: "API service",
    value: "Operational · 128 ms",
    state: "ok" as const,
  },
  {
    label: "Database",
    value: "Operational · 41% load",
    state: "ok" as const,
  },
  {
    label: "File storage",
    value: "Warning · 78% used",
    state: "warn" as const,
  },
  {
    label: "Notifications",
    value: "Operational · queue clear",
    state: "ok" as const,
  },
  {
    label: "Nightly backup",
    value: "Completed 02:00",
    state: "ok" as const,
  },
];

const defaultActivity = [
  {
    actor: "System administrator",
    action: "Suspended validator account",
    time: "Today · 15:04",
  },
  {
    actor: "System administrator",
    action: "Approved investigator account request",
    time: "Today · 12:20",
  },
  {
    actor: "System",
    action: "Retention policy applied to 12 closed cases",
    time: "Yesterday · 17:02",
  },
  {
    actor: "System administrator",
    action: "Added a support organisation",
    time: "Yesterday · 08:15",
  },
];

function formatActivityTime(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneColor(tone: Tone) {
  switch (tone) {
    case "ok":
      return colors.success;
    case "warn":
      return colors.warning;
    case "danger":
      return colors.error;
    default:
      return colors.info;
  }
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const [accounts, activity] = await Promise.all([
        getStaffAccounts(),
        getStaffAuditLogs(),
      ]);

      setStaff(accounts);
      setAuditLogs(activity);
    } catch (error) {
      console.error("Unable to load administrator dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadDashboard]);

  const activeOfficers = staff.filter(
    (account) => account.role === "case_officer" && account.isActive,
  ).length;

  const activeCheckers = staff.filter(
    (account) =>
      (account.role === "evidence_checker" ||
        (account.role as string) === "evidence_validator") &&
      account.isActive,
  ).length;

  const inactiveAccounts = staff.filter((account) => !account.isActive).length;

  const kpis: {
    label: string;
    value: string | number;
    tone: Tone;
    route?: string;
  }[] = [
    {
      label: "Total users",
      value: staff.length,
      tone: "info",
      route: "/admin/staff",
    },
    {
      label: "Active officers",
      value: activeOfficers,
      tone: "info",
      route: "/admin/staff",
    },
    {
      label: "Active checkers",
      value: activeCheckers,
      tone: "ok",
      route: "/admin/checkers",
    },
    {
      label: "Pending account requests",
      value: inactiveAccounts,
      tone: "warn",
      route: "/admin/staff",
    },
    {
      label: "Security alerts",
      value: 4,
      tone: "danger",
      route: "/admin/audit",
    },
    {
      label: "Active cases",
      value: 212,
      tone: "info",
    },
  ];

  const activity = useMemo(() => {
    if (auditLogs.length === 0) {
      return defaultActivity;
    }

    return auditLogs.slice(0, 4).map((entry) => ({
      actor: entry.actorEmail || "System administrator",
      action: entry.description,
      time: formatActivityTime(entry.timestamp),
    }));
  }, [auditLogs]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.adminHeader}>
          <View style={styles.identityRow}>
            <View style={styles.identity}>
              <View style={styles.logo}>
                <AppIcon name="balance" size={18} color={colors.gold[300]} />
              </View>

              <View>
                <Text style={styles.identityLabel}>System administration</Text>
                <Text style={styles.identityName}>
                  {user?.full_name || "T. Wickrama"}
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.alertButton}
              onPress={() => router.push("/admin/audit")}
              accessibilityRole="button"
              accessibilityLabel="Security alerts, 4 open"
            >
              <AppIcon
                name="shield-alert"
                size={20}
                color={colors.textInverse}
              />

              <View style={styles.alertCounter}>
                <Text style={styles.alertCounterText}>4</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.securityNotice}>
            <Text style={styles.securityNoticeText}>
              <Text style={styles.securityNoticeStrong}>
                1 critical security alert
              </Text>{" "}
              is open: repeated failed sign-in attempts against an investigator
              account.
            </Text>
          </View>
        </View>

        <View style={styles.kpiSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.kpiGrid}>
              {kpis.map((kpi) => (
                <Pressable
                  key={kpi.label}
                  style={styles.kpiCard}
                  onPress={
                    kpi.route ? () => router.push(kpi.route as any) : undefined
                  }
                >
                  <View style={styles.kpiLabelRow}>
                    <View
                      style={[
                        styles.kpiDot,
                        {
                          backgroundColor: toneColor(kpi.tone),
                        },
                      ]}
                    />

                    <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  </View>

                  <Text
                    style={[
                      styles.kpiValue,
                      {
                        color: toneColor(kpi.tone),
                      },
                    ]}
                  >
                    {kpi.value}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sections}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>System health</Text>
                <Text style={styles.sectionDescription}>
                  Live service status.
                </Text>
              </View>

              <View style={styles.warningBadge}>
                <View style={styles.warningDot} />
                <Text style={styles.warningBadgeText}>1 warning</Text>
              </View>
            </View>

            <View style={styles.sectionBody}>
              {systemHealth.map((item) => {
                const warning = item.state === "warn";

                return (
                  <View key={item.label} style={styles.healthRow}>
                    <View style={styles.healthDetails}>
                      <Text style={styles.healthLabel}>{item.label}</Text>
                      <Text style={styles.healthValue}>{item.value}</Text>
                    </View>

                    <View
                      style={[
                        styles.healthBadge,
                        warning
                          ? styles.healthWarningBadge
                          : styles.healthOkBadge,
                      ]}
                    >
                      <View
                        style={[
                          styles.healthDot,
                          {
                            backgroundColor: warning
                              ? colors.warning
                              : colors.success,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.healthBadgeText,
                          {
                            color: warning ? colors.warning : colors.success,
                          },
                        ]}
                      >
                        {warning ? "Warning" : "Operational"}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <Pressable
                style={styles.textLink}
                onPress={() => router.push("/admin/categories")}
              >
                <Text style={styles.textLinkLabel}>
                  Open backup & system health
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Evidence Operations</Text>
                <Text style={styles.sectionDescription}>
                  Checker availability & workload distribution
                </Text>
              </View>

              <Pressable onPress={() => router.push("/admin/checkers" as any)}>
                <Text style={styles.auditLink}>Manage</Text>
              </Pressable>
            </View>

            <View style={styles.sectionBody}>
              <View style={styles.healthRow}>
                <View style={styles.healthDetails}>
                  <Text style={styles.healthLabel}>Evidence Checkers</Text>
                  <Text style={styles.healthValue}>
                    {activeCheckers} active authorized staff ready for assignment
                  </Text>
                </View>

                <Pressable
                  style={styles.actionPill}
                  onPress={() => router.push("/admin/checkers" as any)}
                >
                  <Text style={styles.actionPillText}>Open</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Recent administrative activity
              </Text>

              <Pressable onPress={() => router.push("/admin/audit")}>
                <Text style={styles.auditLink}>Audit log</Text>
              </Pressable>
            </View>

            <View style={styles.sectionBody}>
              {activity.map((item, index) => (
                <View
                  key={`${item.time}-${index}`}
                  style={[
                    styles.activityRow,
                    index === activity.length - 1 && styles.lastActivityRow,
                  ]}
                >
                  <View style={styles.activityDot} />

                  <View style={styles.activityContent}>
                    <Text style={styles.activityAction}>{item.action}</Text>
                    <Text style={styles.activityMeta}>
                      {item.actor} · {item.time}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy[900],
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 22,
    backgroundColor: colors.background,
  },
  adminHeader: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 28,
    backgroundColor: colors.navy[900],
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.royal[500],
    backgroundColor: colors.royal[700],
  },
  identityLabel: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.navy[300],
  },
  identityName: {
    marginTop: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.textInverse,
  },
  alertButton: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCounter: {
    position: "absolute",
    right: 3,
    top: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.navy[900],
    backgroundColor: colors.error,
  },
  alertCounterText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textInverse,
  },
  securityNotice: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.navy[800],
  },
  securityNoticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.navy[100],
  },
  securityNoticeStrong: {
    fontWeight: "700",
    color: colors.textInverse,
  },
  kpiSection: {
    marginTop: -16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    height: 100,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  kpiCard: {
    width: "48.6%",
    minHeight: 89,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.navy[900],
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  kpiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  kpiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kpiLabel: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    color: colors.textSecondary,
  },
  kpiValue: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "800",
  },
  sections: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  sectionCard: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  sectionDescription: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#FAEBC8",
    backgroundColor: "#FDF6E7",
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  warningBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.warning,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  healthRow: {
    minHeight: 55,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  healthDetails: {
    flex: 1,
  },
  healthLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  healthValue: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  healthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  healthOkBadge: {
    borderColor: "#D2EDE1",
    backgroundColor: "#EAF6F0",
  },
  healthWarningBadge: {
    borderColor: "#FAEBC8",
    backgroundColor: "#FDF6E7",
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  textLink: {
    paddingTop: 12,
  },
  textLinkLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  auditLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.royal[700],
  },
  activityRow: {
    paddingVertical: 10,
    flexDirection: "row",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastActivityRow: {
    borderBottomWidth: 0,
  },
  activityDot: {
    width: 6,
    height: 6,
    marginTop: 6,
    borderRadius: 3,
    backgroundColor: colors.navy[300],
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.navy[800],
  },
  activityMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
    alignItems: "center",
    justifyContent: "center",
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
