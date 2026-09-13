import { useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuditEvent, getAuditEvents } from "../audit";
import {
  getAllRoles,
  getPermissionsForRole,
  Permission,
  SystemRole,
  useAuth,
} from "../auth";
import { AppIcon, AppIconName } from "../components/AppIcon";
import {
  getStaffAccountById,
  getStaffAccounts,
  StaffAccount,
  toggleStaffActive,
} from "../staff";
import { colors, iconSizes } from "../theme";

type Tone = "info" | "ok" | "warn" | "danger" | "neutral";

type SecurityAlert = {
  id: string;
  title: string;
  level: "critical" | "high" | "medium" | "low";
  category: string;
  at: string;
  user: string;
  ip: string;
  detail: string;
  recommendation: string;
  resources: string[];
  status: "open" | "investigating" | "resolved";
};

const SECURITY_ALERTS: SecurityAlert[] = [
  {
    id: "SA-3312",
    title: "Repeated failed sign-in attempts",
    level: "critical",
    category: "Failed login attempts",
    at: "12 Aug 2026 · 13:12",
    user: "Target account: USR-10241",
    ip: "203.94.x.x · Unrecognised device",
    detail:
      "11 failed sign-in attempts against one investigator account within 6 minutes, from a single unrecognised address.",
    recommendation:
      "Lock the source address, require a password reset and confirm two-factor enrolment.",
    resources: ["auth/login", "USR-10241", "AL-90410"],
    status: "open",
  },
  {
    id: "SA-3311",
    title: "Unusual evidence archive access",
    level: "high",
    category: "Unusual file access",
    at: "11 Aug 2026 · 22:05",
    user: "D. Kumara · Evidence validator",
    ip: "112.134.x.x · Unrecognised network",
    detail:
      "48 evidence files opened in 9 minutes, outside the account's normal working hours.",
    recommendation:
      "Review the access list with the validator's supervisor before restoring the account.",
    resources: ["evidence/archive", "USR-10318"],
    status: "investigating",
  },
  {
    id: "SA-3310",
    title: "Permission set modified",
    level: "medium",
    category: "Permission changes",
    at: "12 Aug 2026 · 15:04",
    user: "T. Wickrama · Administrator",
    ip: "10.24.8.12 · Internal network",
    detail:
      'Evidence validator role gained the "View all cases" permission for 4 minutes before being reverted.',
    recommendation:
      "Confirm the change was intentional and record the justification in the audit note.",
    resources: ["roles/validator", "AL-90412"],
    status: "open",
  },
  {
    id: "SA-3309",
    title: "Increased file storage error rate",
    level: "low",
    category: "System errors",
    at: "11 Aug 2026 · 19:31",
    user: "System",
    ip: "storage-node-02",
    detail:
      "Upload retries rose to 3.2% for 20 minutes during the nightly backup window.",
    recommendation: "No action needed; monitor the next backup window.",
    resources: ["storage/node-02"],
    status: "open",
  },
];

const SYSTEM_HEALTH = [
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

const PERMISSION_ROWS: {
  label: string;
  permission: Permission;
}[] = [
  { label: "View own cases", permission: "cases:read:own" },
  { label: "View all cases", permission: "cases:read:all" },
  {
    label: "Investigate cases",
    permission: "cases:update:status",
  },
  {
    label: "Validate evidence",
    permission: "evidence:validate",
  },
  {
    label: "Update case status",
    permission: "cases:update:status",
  },
  {
    label: "Message reporters",
    permission: "cases:request_info",
  },
  {
    label: "Manage users",
    permission: "admin:users:manage",
  },
  {
    label: "View audit logs",
    permission: "admin:audit_logs:read",
  },
  {
    label: "Modify system settings",
    permission: "admin:system:configure",
  },
];

function valueFromParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function roleLabel(role: SystemRole) {
  switch (role) {
    case "reporter":
      return "Reporter";
    case "case_officer":
      return "Case investigator";
    case "evidence_checker":
      return "Evidence validator";
    case "system_admin":
      return "System administrator";
  }
}

function formatDate(timestamp?: string) {
  if (!timestamp) return "Not recorded";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Header({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          style={styles.headerButton}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/admin")
          }
        >
          <AppIcon name="chevron-left" size={20} color={colors.navy[700]} />
        </Pressable>
      ) : null}

      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContent}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? (
            <Text style={styles.sectionDescription}>{description}</Text>
          ) : null}
        </View>
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DataRow({
  label,
  value,
  restricted,
}: {
  label: string;
  value: string;
  restricted?: boolean;
}) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>
        {value}
        {restricted ? (
          <Text style={styles.restrictedText}> · Restricted</Text>
        ) : null}
      </Text>
    </View>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map = {
    info: {
      bg: "#EDF3FE",
      border: "#D9E5FC",
      text: colors.info,
    },
    ok: {
      bg: "#EAF6F0",
      border: "#D2EDE1",
      text: colors.success,
    },
    warn: {
      bg: "#FDF6E7",
      border: "#FAEBC8",
      text: colors.warning,
    },
    danger: {
      bg: "#FBEEEC",
      border: "#F6DAD6",
      text: colors.error,
    },
    neutral: {
      bg: colors.navy[50],
      border: colors.border,
      text: colors.textSecondary,
    },
  }[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: map.bg,
          borderColor: map.border,
        },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: map.text }]} />
      <Text style={[styles.badgeText, { color: map.text }]}>{children}</Text>
    </View>
  );
}

function Notice({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "privacy" | "info";
  title: string;
  children: ReactNode;
}) {
  const map: {
    background: string;
    border: string;
    color: string;
    icon: AppIconName;
  } =
    tone === "privacy"
      ? {
          background: colors.teal[50],
          border: colors.teal[100],
          color: colors.teal[700],
          icon: "lock",
        }
      : tone === "info"
        ? {
            background: colors.royal[50],
            border: colors.royal[100],
            color: colors.royal[700],
            icon: "shield-check",
          }
        : {
            background: "#FDF6E7",
            border: "#FAEBC8",
            color: colors.warning,
            icon: "warning",
          };

  return (
    <View
      style={[
        styles.notice,
        {
          backgroundColor: map.background,
          borderColor: map.border,
        },
      ]}
    >
      <AppIcon name={map.icon} size={16} color={map.color} />
      <View style={styles.noticeContent}>
        <Text style={[styles.noticeTitle, { color: map.color }]}>{title}</Text>
        <Text style={styles.noticeText}>{children}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = "primary",
  icon,
  full = true,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
  icon?: AppIconName;
  full?: boolean;
}) {
  const danger = variant === "danger";
  const outline = variant === "outline";

  return (
    <Pressable
      style={[
        styles.actionButton,
        full && styles.fullButton,
        danger
          ? styles.dangerButton
          : outline
            ? styles.outlineButton
            : styles.primaryButton,
      ]}
      onPress={onPress}
    >
      {icon ? (
        <AppIcon
          name={icon}
          size={15}
          color={
            danger
              ? colors.error
              : outline
                ? colors.navy[700]
                : colors.textInverse
          }
        />
      ) : null}

      <Text
        style={[
          styles.actionButtonText,
          danger
            ? styles.dangerButtonText
            : outline
              ? styles.outlineButtonText
              : styles.primaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SettingsRow({
  label,
  hint,
  icon,
  route,
  danger,
  onPress,
}: {
  label: string;
  hint?: string;
  icon: AppIconName;
  route?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.settingsRow}
      onPress={() => {
        if (onPress) onPress();
        else if (route) router.push(route as any);
      }}
    >
      <View style={[styles.settingsIcon, danger && styles.dangerSettingsIcon]}>
        <AppIcon
          name={icon}
          size={17}
          color={danger ? colors.error : colors.navy[700]}
        />
      </View>

      <View style={styles.settingsInformation}>
        <Text style={[styles.settingsLabel, danger && { color: colors.error }]}>
          {label}
        </Text>
        {hint ? <Text style={styles.settingsHint}>{hint}</Text> : null}
      </View>

      <AppIcon name="chevron-right" size={16} color={colors.navy[300]} />
    </Pressable>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.settingsGroup}>
      <Text style={styles.settingsGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function HealthRow({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: "ok" | "warn";
}) {
  const warning = state === "warn";

  return (
    <View style={styles.healthRow}>
      <View style={styles.healthInformation}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>{value}</Text>
      </View>

      <Badge tone={warning ? "warn" : "ok"}>
        {warning ? "Warning" : "Operational"}
      </Badge>
    </View>
  );
}

/* ADMIN SETTINGS */

export function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [policies, setPolicies] = useState({
    mfa: true,
    downloads: true,
    timeout: true,
    maintenance: false,
  });

  const performSignOut = async () => {
    try {
      await signOut();
      router.replace("/login");
    } catch (error) {
      Alert.alert(
        "Could not sign out",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const handleSignOut = () => {
    const message = "Administrator sessions end immediately when you sign out.";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Sign out?\n\n${message}`);

      if (confirmed) {
        void performSignOut();
      }

      return;
    }

    Alert.alert("Sign out?", message, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void performSignOut(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header
        title="Admin settings"
        subtitle={`${user?.full_name || "T. Wickrama"} · System administrator`}
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <SettingsGroup title="ADMINISTRATION">
          <SettingsRow
            label="User management"
            hint="Manage registered accounts"
            icon="users"
            route="/admin/staff"
          />
          <SettingsRow
            label="Roles & permissions"
            hint="4 roles · 9 permissions"
            icon="roles"
            route="/admin/roles"
          />
          <SettingsRow
            label="System configuration"
            hint="Categories, statuses, languages"
            icon="settings"
            route="/admin/config"
          />
        </SettingsGroup>

        <SettingsGroup title="SECURITY & DATA">
          <SettingsRow
            label="Security alerts"
            hint="4 open · 1 critical"
            icon="shield-alert"
            route="/admin/alerts"
          />
          <SettingsRow
            label="Audit logs"
            hint="Immutable · 7 year retention"
            icon="activity"
            route="/admin/audit"
          />
          <SettingsRow
            label="Backup & system health"
            hint="Last backup 02:00"
            icon="shield-check"
            route="/admin/backup"
          />
        </SettingsGroup>

        <SectionCard title="Platform policies">
          <PolicyToggle
            label="Require two-factor for all staff accounts"
            value={policies.mfa}
            onChange={(value) =>
              setPolicies((current) => ({
                ...current,
                mfa: value,
              }))
            }
          />
          <PolicyToggle
            label="Block evidence downloads to personal devices"
            value={policies.downloads}
            onChange={(value) =>
              setPolicies((current) => ({
                ...current,
                downloads: value,
              }))
            }
          />
          <PolicyToggle
            label="Automatic session timeout after 15 minutes"
            value={policies.timeout}
            onChange={(value) =>
              setPolicies((current) => ({
                ...current,
                timeout: value,
              }))
            }
          />
          <PolicyToggle
            label="Maintenance mode"
            hint="Shows a maintenance screen to all users."
            value={policies.maintenance}
            onChange={(value) =>
              setPolicies((current) => ({
                ...current,
                maintenance: value,
              }))
            }
          />
        </SectionCard>

        <SettingsGroup title="ACCOUNT">
          <SettingsRow
            label="Sign out"
            icon="x"
            danger
            onPress={handleSignOut}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.policyRow}>
      <View style={styles.policyInformation}>
        <Text style={styles.policyLabel}>{label}</Text>
        {hint ? <Text style={styles.policyHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: colors.navy[100],
          true: colors.teal[600],
        }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

/* SECURITY ALERTS */

export function AlertsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "investigating" | "resolved">("open");

  const list = SECURITY_ALERTS.filter((alert) => alert.status === tab);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title="Security alerts" subtitle="4 open · 1 critical" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.statGrid}>
          {[
            { label: "Critical", value: 1, tone: "danger" as Tone },
            { label: "High", value: 1, tone: "warn" as Tone },
            { label: "Medium", value: 1, tone: "info" as Tone },
            { label: "Low", value: 1, tone: "neutral" as Tone },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={styles.statLabelRow}>
                <Badge tone={stat.tone}>{stat.label}</Badge>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pillTabs}>
          {[
            { id: "open", label: "Open", count: 4 },
            {
              id: "investigating",
              label: "Investigating",
              count: 1,
            },
            { id: "resolved", label: "Resolved", count: 12 },
          ].map((item) => {
            const active = tab === item.id;

            return (
              <Pressable
                key={item.id}
                style={[styles.pill, active && styles.activePill]}
                onPress={() => setTab(item.id as any)}
              >
                <Text
                  style={[styles.pillText, active && styles.activePillText]}
                >
                  {item.label} {item.count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {list.length === 0 ? (
          <View style={styles.emptyState}>
            <AppIcon
              name="shield-check"
              size={iconSizes.xl}
              color={colors.success}
            />
            <Text style={styles.emptyTitle}>No alerts in this section</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((alert) => (
              <Pressable
                key={alert.id}
                style={[
                  styles.alertCard,
                  alert.level === "critical" && styles.criticalAlert,
                ]}
                onPress={() => router.push(`/admin/alerts/${alert.id}` as any)}
              >
                <View style={styles.rowTop}>
                  <View style={styles.flex}>
                    <Text style={styles.smallMeta}>
                      {alert.id} · {alert.category}
                    </Text>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                  </View>
                  <AppIcon
                    name="chevron-right"
                    size={16}
                    color={colors.navy[300]}
                  />
                </View>

                <Text style={styles.alertDescription}>{alert.detail}</Text>

                <View style={styles.alertFooter}>
                  <Badge
                    tone={
                      alert.level === "critical"
                        ? "danger"
                        : alert.level === "high"
                          ? "warn"
                          : alert.level === "medium"
                            ? "info"
                            : "neutral"
                    }
                  >
                    {alert.level} priority
                  </Badge>
                  <Text style={styles.smallMeta}>{alert.at}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AlertDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const alert =
    SECURITY_ALERTS.find((item) => item.id === valueFromParam(id)) ||
    SECURITY_ALERTS[0];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title="Security alert" subtitle={alert.id} back />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View
          style={[
            styles.heroCard,
            alert.level === "critical" && styles.criticalAlert,
          ]}
        >
          <View style={styles.rowTop}>
            <View style={styles.flex}>
              <Text style={styles.smallMeta}>{alert.category}</Text>
              <Text style={styles.heroTitle}>{alert.title}</Text>
            </View>
            <Badge tone={alert.level === "critical" ? "danger" : "warn"}>
              {alert.level} priority
            </Badge>
          </View>

          <Text style={styles.heroDescription}>{alert.detail}</Text>
        </View>

        <SectionCard title="Event details">
          <DataRow label="Alert ID" value={alert.id} />
          <DataRow label="Detected" value={alert.at} />
          <DataRow label="Account" value={alert.user} />
          <DataRow label="Origin" value={alert.ip} restricted />
          <DataRow label="Status" value="Open · unassigned" />
        </SectionCard>

        <SectionCard title="Related resources">
          <View style={styles.resourceList}>
            {alert.resources.map((resource) => (
              <View key={resource} style={styles.resourceChip}>
                <Text style={styles.resourceText}>{resource}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Recommended action">
          <Text style={styles.bodyText}>{alert.recommendation}</Text>

          <View style={styles.sectionAction}>
            <ActionButton
              label="Suspend affected account"
              icon="x"
              variant="danger"
              onPress={() =>
                Alert.alert(
                  "Account suspended",
                  "The affected account has been blocked in this UI prototype.",
                )
              }
            />
          </View>
        </SectionCard>

        <Notice title="Escalation policy">
          Critical alerts that remain open for more than 4 hours are escalated
          to the security lead automatically.
        </Notice>
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton
          label="Investigate"
          variant="outline"
          full={false}
          onPress={() => router.push("/admin/audit")}
        />
        <ActionButton
          label="Resolve alert"
          full
          onPress={() => {
            Alert.alert("Resolved", "The alert is marked resolved.");
            router.replace("/admin/alerts" as any);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* BACKUP */

export function BackupScreen() {
  const [running, setRunning] = useState(false);

  const runBackup = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      Alert.alert(
        "Backup completed",
        "The encrypted backup completed successfully.",
      );
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title="Backup & system health" back />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.successPanel}>
          <AppIcon name="shield-check" size={18} color={colors.success} />
          <View style={styles.flex}>
            <Text style={styles.successTitle}>
              Last backup completed successfully
            </Text>
            <Text style={styles.successText}>
              12 Aug 2026 · 02:00 · 41 GB · verified checksum
            </Text>
          </View>
        </View>

        <SectionCard title="Backup schedule">
          <DataRow label="Last successful backup" value="12 Aug 2026 · 02:00" />
          <DataRow label="Next scheduled backup" value="13 Aug 2026 · 02:00" />
          <DataRow label="Frequency" value="Daily, encrypted, off-site" />
          <DataRow label="Restore tested" value="1 Aug 2026 · passed" />

          <View style={styles.buttonList}>
            <ActionButton
              label={running ? "Running backup..." : "Run backup now"}
              onPress={runBackup}
            />
            <ActionButton
              label="Verify latest backup"
              variant="outline"
              onPress={() =>
                Alert.alert(
                  "Backup verified",
                  "Checksum verification completed successfully.",
                )
              }
            />
            <ActionButton
              label="View backup history"
              variant="outline"
              onPress={() =>
                Alert.alert(
                  "Backup history",
                  "The latest 30 encrypted backups are available.",
                )
              }
            />
          </View>
        </SectionCard>

        <SectionCard title="Service status">
          {SYSTEM_HEALTH.map((item) => (
            <HealthRow key={item.label} {...item} />
          ))}
        </SectionCard>

        <SectionCard title="Storage">
          <View style={styles.storageHeader}>
            <Text style={styles.storageTitle}>3.9 TB of 5 TB used</Text>
            <Text style={styles.storagePercentage}>78%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={styles.progressValue} />
          </View>

          <DataRow label="Evidence files" value="3.1 TB" />
          <DataRow label="Case records" value="0.6 TB" />
          <DataRow label="Backups & logs" value="0.2 TB" />
          <DataRow label="Service uptime (90 days)" value="99.97%" />
        </SectionCard>

        <Notice title="Storage is approaching capacity">
          At 85% new evidence uploads are throttled. Apply the retention policy
          to closed cases or add capacity before 20 Aug.
        </Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

/* CONFIGURATION */

export function ConfigurationScreen() {
  const unavailable = (label: string) =>
    Alert.alert(
      label,
      "This configuration UI is ready, but its backend is not implemented yet.",
    );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title="System configuration" back />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <SettingsGroup title="CASE HANDLING">
          <SettingsRow
            label="Case categories"
            hint="Manage active report categories"
            icon="category"
            route="/admin/categories"
          />
          <SettingsRow
            label="Case statuses"
            hint="8 statuses · 2 terminal"
            icon="activity"
            onPress={() => unavailable("Case statuses")}
          />
          <SettingsRow
            label="Priority levels"
            hint="Critical, High, Medium, Low"
            icon="warning"
            onPress={() => unavailable("Priority levels")}
          />
        </SettingsGroup>

        <SettingsGroup title="EVIDENCE">
          <SettingsRow
            label="Accepted file types"
            hint="JPG, PNG, MP4, M4A, PDF · max 100 MB"
            icon="clipboard-check"
            onPress={() => unavailable("Accepted file types")}
          />
          <SettingsRow
            label="Retention policy"
            hint="Cases 7 years · evidence 7 years"
            icon="history"
            onPress={() => unavailable("Retention policy")}
          />
        </SettingsGroup>

        <SettingsGroup title="COMMUNICATION">
          <SettingsRow
            label="Notification templates"
            hint="12 templates in 3 languages"
            icon="activity"
            onPress={() => unavailable("Notification templates")}
          />
          <SettingsRow
            label="Languages"
            hint="English, Sinhala, Tamil"
            icon="settings"
            onPress={() => unavailable("Languages")}
          />
          <SettingsRow
            label="Support organisations"
            hint="5 published organisations"
            icon="users"
            onPress={() => unavailable("Support organisations")}
          />
        </SettingsGroup>

        <SettingsGroup title="PRIVACY">
          <SettingsRow
            label="Privacy defaults"
            hint="Discreet notifications on by default"
            icon="lock"
            onPress={() => unavailable("Privacy defaults")}
          />
        </SettingsGroup>

        <Notice title="Changes take effect immediately">
          Editing categories or statuses affects open cases. Existing records
          keep their original values for the audit trail.
        </Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ROLES */

export function RolesScreen() {
  const router = useRouter();
  const roles = getAllRoles();
  const [staff, setStaff] = useState<StaffAccount[]>([]);

  useEffect(() => {
    void getStaffAccounts().then(setStaff);
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header
        title="Roles & permissions"
        subtitle={`${staff.length} accounts`}
        back
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <SectionCard title="Roles">
          {roles.map((role, index) => (
            <View
              key={role.id}
              style={[
                styles.roleSummary,
                index === roles.length - 1 && styles.lastBorderlessRow,
              ]}
            >
              <View style={styles.flex}>
                <Text style={styles.roleName}>{roleLabel(role.id)}</Text>
                <Text style={styles.roleHint}>{role.description}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {staff.filter((account) => account.role === role.id).length}
                </Text>
              </View>
            </View>
          ))}
        </SectionCard>

        <SectionCard
          title="Permission matrix"
          description="R = Reporter, I = Investigator, V = Validator, A = Admin."
        >
          <ScrollView horizontal>
            <View style={styles.permissionTable}>
              <View style={styles.permissionHeader}>
                <Text style={styles.permissionNameHeader}>PERMISSION</Text>
                {["R", "I", "V", "A"].map((label) => (
                  <Text key={label} style={styles.permissionColumnHeader}>
                    {label}
                  </Text>
                ))}
              </View>

              {PERMISSION_ROWS.map((row) => (
                <View
                  key={`${row.label}-${row.permission}`}
                  style={styles.permissionRow}
                >
                  <Text style={styles.permissionName}>{row.label}</Text>

                  {roles.map((role) => {
                    const allowed = role.permissions.includes(row.permission);

                    return (
                      <View key={role.id} style={styles.permissionCell}>
                        <View
                          style={[
                            styles.permissionMark,
                            allowed ? styles.allowedMark : styles.deniedMark,
                          ]}
                        >
                          <Text
                            style={[
                              styles.permissionMarkText,
                              {
                                color: allowed
                                  ? colors.success
                                  : colors.navy[300],
                              },
                            ]}
                          >
                            {allowed ? "Allow" : "Deny"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </SectionCard>

        <Notice title="Least privilege">
          Give a role only what it needs. Widening a permission affects every
          account holding that role and is recorded as a security event.
        </Notice>
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton
          label="Cancel"
          variant="outline"
          full={false}
          onPress={() => router.back()}
        />
        <ActionButton
          label="Save permission changes"
          onPress={() =>
            Alert.alert(
              "Permissions saved",
              "The role permission configuration has been saved locally.",
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

/* AUDIT */

function auditResult(event: AuditEvent) {
  return event.eventType === "SECURITY_POLICY_VIOLATION"
    ? "Failure"
    : "Success";
}

export function AuditScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "success" | "failure">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setEvents(await getAuditEvents(undefined, role || "system_admin"));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return events.filter((event) => {
      const result = auditResult(event).toLowerCase();
      const tabMatches = tab === "all" || result === tab;

      const searchMatches =
        !query ||
        event.actorEmail.toLowerCase().includes(query) ||
        event.action.toLowerCase().includes(query) ||
        event.targetId.toLowerCase().includes(query);

      return tabMatches && searchMatches;
    });
  }, [events, search, tab]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header
        title="Audit logs"
        subtitle="Every action, permanently recorded"
        right={
          <Pressable
            style={styles.headerButton}
            onPress={() =>
              Alert.alert(
                "Export",
                `${filtered.length} records are ready for export.`,
              )
            }
          >
            <Text style={styles.downloadIcon}>â†“</Text>
          </Pressable>
        }
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.search}>
          <AppIcon name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="Search user, action or resource"
            placeholderTextColor={colors.textSoft}
          />
        </View>

        <View style={styles.pillTabs}>
          {[
            { id: "all", label: "All", count: events.length },
            {
              id: "success",
              label: "Success",
              count: events.filter((event) => auditResult(event) === "Success")
                .length,
            },
            {
              id: "failure",
              label: "Failure",
              count: events.filter((event) => auditResult(event) === "Failure")
                .length,
            },
          ].map((item) => {
            const active = tab === item.id;

            return (
              <Pressable
                key={item.id}
                style={[styles.pill, active && styles.activePill]}
                onPress={() => setTab(item.id as any)}
              >
                <Text
                  style={[styles.pillText, active && styles.activePillText]}
                >
                  {item.label} {item.count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.filterList}
          showsHorizontalScrollIndicator={false}
        >
          {[
            "Filters",
            "User: All",
            "Role: All",
            "Action: All",
            "Date: Last 7 days",
            "Result: All",
          ].map((filter) => (
            <View key={filter} style={styles.filterChip}>
              <Text style={styles.filterText}>{filter}</Text>
            </View>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((event) => {
              const result = auditResult(event);

              return (
                <Pressable
                  key={event.id}
                  style={styles.auditCard}
                  onPress={() => router.push(`/admin/audit/${event.id}` as any)}
                >
                  <View style={styles.flex}>
                    <Text style={styles.smallMeta}>
                      {formatDate(event.timestamp)}
                    </Text>
                    <Text style={styles.auditAction}>{event.action}</Text>
                    <Text style={styles.auditActor}>
                      {event.actorEmail} · {roleLabel(event.actorRole)}
                    </Text>
                    <Text style={styles.resourceLink}>{event.targetId}</Text>
                  </View>

                  <View style={styles.auditRight}>
                    <Badge tone={result === "Success" ? "ok" : "danger"}>
                      {result}
                    </Badge>
                    <AppIcon
                      name="chevron-right"
                      size={15}
                      color={colors.navy[300]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.retentionText}>
          Audit entries cannot be edited or deleted. Retention: 7 years.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export function AuditDetailScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { id } = useLocalSearchParams();
  const [event, setEvent] = useState<AuditEvent | null>(null);

  useEffect(() => {
    void getAuditEvents(undefined, role || "system_admin").then((events) => {
      setEvent(
        events.find((item) => item.id === valueFromParam(id)) ||
          events[0] ||
          null,
      );
    });
  }, [id, role]);

  if (!event) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const result = auditResult(event);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title="Audit entry" subtitle={event.id} back />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.rowTop}>
            <View style={styles.flex}>
              <Text style={styles.smallMeta}>
                {formatDate(event.timestamp)}
              </Text>
              <Text style={styles.heroTitle}>{event.action}</Text>
            </View>
            <Badge tone={result === "Success" ? "ok" : "danger"}>
              {result}
            </Badge>
          </View>
        </View>

        <SectionCard title="Event details">
          <DataRow label="Entry ID" value={event.id} />
          <DataRow label="Timestamp" value={formatDate(event.timestamp)} />
          <DataRow label="User" value={event.actorEmail} />
          <DataRow label="Role" value={roleLabel(event.actorRole)} />
          <DataRow label="Action" value={event.action} />
          <DataRow label="Resource" value={event.targetId} />
          <DataRow label="Result" value={result} />
        </SectionCard>

        <SectionCard title="Origin">
          <DataRow
            label="Address & device"
            value={`${event.ipAddress || "Not recorded"} · ${
              event.userAgent || "Unknown device"
            }`}
            restricted
          />
          <DataRow label="Session" value="SES-4471 · started 14:02" />
          <DataRow
            label="Authentication"
            value="Password + authenticator app"
          />
        </SectionCard>

        <SectionCard
          title="Change record"
          description="What the action modified."
        >
          <View style={styles.changeRecord}>
            <Text style={styles.changeTitle}>Description</Text>
            <Text style={styles.changeText}>{event.description}</Text>
          </View>
        </SectionCard>

        <Notice tone="privacy" title="No case content is logged">
          Audit entries record who did what and when. They never contain report
          text, victim details or evidence content.
        </Notice>
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton
          label="Back to log"
          variant="outline"
          full={false}
          onPress={() => router.replace("/admin/audit")}
        />
        <ActionButton
          label="Open related alert"
          onPress={() => router.push("/admin/alerts/SA-3312" as any)}
        />
      </View>
    </SafeAreaView>
  );
}

/* USER DETAIL */

export function UserDetailScreen() {
  const router = useRouter();
  const { user: admin } = useAuth();
  const { id } = useLocalSearchParams();
  const [account, setAccount] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getStaffAccountById(valueFromParam(id) || "").then((result) => {
      setAccount(result);
      setLoading(false);
    });
  }, [id]);

  if (loading || !account) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const permissions = getPermissionsForRole(account.role);

  const changeStatus = async () => {
    const nextStatus = !account.isActive;

    const result = await toggleStaffActive(
      account.id,
      nextStatus,
      admin?.email || "admin@justicenow.org",
      nextStatus ? "Account restored" : "Account suspended",
    );

    if (result.success && result.staff) {
      setAccount(result.staff);
      Alert.alert(
        "Account updated",
        `The account is now ${nextStatus ? "active" : "suspended"}.`,
      );
    } else {
      Alert.alert(
        "Update failed",
        result.error || "The account could not be updated.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header
        title={account.fullName}
        subtitle={`${account.id} · ${roleLabel(account.role)}`}
        back
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.userHero}>
          <View style={styles.largeAvatar}>
            <Text style={styles.largeAvatarText}>
              {account.fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.flex}>
            <Text style={styles.userHeroName}>{account.fullName}</Text>
            <Text style={styles.userHeroEmail}>{account.email}</Text>
          </View>

          <Badge tone={account.isActive ? "ok" : "danger"}>
            {account.isActive ? "Active" : "Suspended"}
          </Badge>
        </View>

        <SectionCard title="Account information">
          <DataRow label="User ID" value={account.id} />
          <DataRow label="Role" value={roleLabel(account.role)} />
          <DataRow
            label="Department"
            value={account.department || "Not provided"}
          />
          <DataRow label="Verification" value="Verified" />
          <DataRow label="Last login" value={formatDate(account.lastLoginAt)} />
          <DataRow label="Two-factor" value="Enabled · authenticator app" />
        </SectionCard>

        <SectionCard
          title="Permissions"
          description="Inherited from the assigned role."
        >
          {permissions.map((permission) => (
            <View key={permission} style={styles.permissionListRow}>
              <Text style={styles.permissionListLabel}>{permission}</Text>
              <Text style={styles.allowedText}>Allowed</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Active sessions" description="2 devices signed in.">
          <DataRow
            label="JusticeNow Android"
            value="Batticaloa · 11 Aug, 22:05"
          />
          <DataRow
            label="Chrome · Windows"
            value="Unrecognised network · 11 Aug, 21:44"
          />
        </SectionCard>

        <SectionCard title="Security events">
          <DataRow
            label="11 Aug · 22:05"
            value="Bulk evidence archive access"
          />
          <DataRow label="10 Aug · 08:12" value="Signed in from a new device" />
          <DataRow
            label="4 Aug · 17:20"
            value="Password changed successfully"
          />
        </SectionCard>

        <SectionCard title="Account actions">
          <View style={styles.buttonList}>
            <ActionButton
              label="Edit role"
              variant="outline"
              onPress={() => router.push("/admin/roles")}
            />
            <ActionButton
              label="Reset password"
              variant="outline"
              onPress={() =>
                Alert.alert(
                  "Password reset",
                  "A password-reset request has been created.",
                )
              }
            />
            <ActionButton
              label="Revoke all sessions"
              variant="outline"
              onPress={() =>
                Alert.alert(
                  "Sessions revoked",
                  "All active sessions have been revoked.",
                )
              }
            />
            <ActionButton
              label={account.isActive ? "Suspend account" : "Restore account"}
              variant={account.isActive ? "danger" : "primary"}
              onPress={() => void changeStatus()}
            />
          </View>
        </SectionCard>

        <Notice title="Administrators cannot read case content">
          These controls manage access only. Opening a case record as an
          administrator is blocked and would appear in the audit log.
        </Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 13 },

  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  downloadIcon: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy[700],
  },

  sectionCard: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitleContent: { flex: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },
  sectionDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  dataRow: {
    minHeight: 45,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dataValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  restrictedText: { color: colors.teal[700] },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10.5, fontWeight: "700" },

  notice: {
    padding: 13,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
  },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: "700" },
  noticeText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  actionButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
  },
  fullButton: { flex: 1 },
  primaryButton: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  outlineButton: {
    backgroundColor: colors.surface,
    borderColor: colors.navy[200],
  },
  dangerButton: {
    backgroundColor: colors.surface,
    borderColor: "#F6DAD6",
  },
  actionButtonText: { fontSize: 13, fontWeight: "700" },
  primaryButtonText: { color: colors.textInverse },
  outlineButtonText: { color: colors.navy[700] },
  dangerButtonText: { color: colors.error },

  settingsGroup: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  settingsGroupTitle: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.textSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  dangerSettingsIcon: { backgroundColor: "#FBEEEC" },
  settingsInformation: { flex: 1 },
  settingsLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  settingsHint: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  policyRow: {
    minHeight: 58,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  policyInformation: { flex: 1 },
  policyLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  policyHint: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  statCard: {
    width: "48.5%",
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statLabelRow: { alignItems: "flex-start" },
  statValue: {
    marginTop: 9,
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy[800],
  },

  pillTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  activePill: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[700],
  },
  activePillText: { color: colors.textInverse },

  list: { gap: 10 },
  alertCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  criticalAlert: {
    borderColor: "#F6DAD6",
    backgroundColor: "#FBEEEC",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  smallMeta: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  alertTitle: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },
  alertDescription: {
    marginTop: 7,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  alertFooter: {
    marginTop: 10,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  emptyState: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },

  heroCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.navy[800],
  },
  heroDescription: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 19,
    color: colors.navy[800],
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.navy[800],
  },
  resourceList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  resourceChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  resourceText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[700],
  },
  sectionAction: { marginTop: 12 },

  footer: {
    minHeight: 68,
    padding: 12,
    flexDirection: "row",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  successPanel: {
    padding: 15,
    borderRadius: 15,
    flexDirection: "row",
    gap: 9,
    borderWidth: 1,
    borderColor: "#D2EDE1",
    backgroundColor: "#EAF6F0",
  },
  successTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.success,
  },
  successText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.success,
  },
  buttonList: { marginTop: 12, gap: 8 },

  healthRow: {
    minHeight: 58,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  healthInformation: { flex: 1 },
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
  storageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  storageTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },
  storagePercentage: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warning,
  },
  progressTrack: {
    height: 8,
    marginTop: 10,
    marginBottom: 10,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.navy[100],
  },
  progressValue: {
    width: "78%",
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.warning,
  },

  roleSummary: {
    minHeight: 62,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastBorderlessRow: { borderBottomWidth: 0 },
  roleName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  roleHint: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  countBadge: {
    minWidth: 34,
    padding: 6,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.navy[50],
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[700],
  },
  permissionTable: { minWidth: 448 },
  permissionHeader: {
    flexDirection: "row",
    paddingBottom: 8,
  },
  permissionNameHeader: {
    width: 208,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  permissionColumnHeader: {
    width: 60,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  permissionRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  permissionName: {
    width: 208,
    fontSize: 12.5,
    color: colors.navy[800],
  },
  permissionCell: { width: 60, alignItems: "center" },
  permissionMark: {
    minWidth: 52,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  allowedMark: { backgroundColor: "#EAF6F0" },
  deniedMark: { backgroundColor: colors.navy[50] },
  permissionMarkText: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },

  search: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    fontSize: 14,
    color: colors.navy[800],
    outlineStyle: "none",
  } as any,
  filterList: { gap: 8 },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  auditCard: {
    padding: 14,
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  auditAction: {
    marginTop: 3,
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  auditActor: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  resourceLink: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  auditRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  retentionText: {
    textAlign: "center",
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  changeRecord: {
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.background,
  },
  changeTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[800],
  },
  changeText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  userHero: {
    padding: 15,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  largeAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[100],
  },
  largeAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy[700],
  },
  userHeroName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy[800],
  },
  userHeroEmail: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },
  permissionListRow: {
    minHeight: 42,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  permissionListLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.navy[800],
  },
  allowedText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.success,
  },
});
