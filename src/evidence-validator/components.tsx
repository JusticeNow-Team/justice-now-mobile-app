import { Href, useRouter } from "expo-router";
import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { AppIcon, AppIconName } from "../components/AppIcon";

import { colors, iconSizes } from "../theme";

import {
  EvidenceDecision,
  EvidencePriority,
  ValidatorEvidenceItem,
  VerificationHistoryItem,
} from "./types";

export function ValidatorHeader({
  title,
  subtitle,
  backTo = "/validator/dashboard",
  rightAction,
}: {
  title: string;
  subtitle?: string;
  backTo?: Href;
  rightAction?: ReactNode;
}) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(backTo);
    }
  };

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={goBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <AppIcon
          name="chevron-left"
          color={colors.navy[700]}
          size={iconSizes.headerBack}
        />
      </Pressable>

      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightAction ? (
        <View>{rightAction}</View>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

export function SectionCard({
  title,
  description,
  children,
  style,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionCard, cardShadow, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>

        {description ? (
          <Text style={styles.sectionDescription}>{description}</Text>
        ) : null}
      </View>

      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type BadgeTone = {
  background: string;
  border: string;
  text: string;
  icon: AppIconName;
};

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "approved":
    case "verified":
    case "completed":
      return {
        background: "#ECF8F3",
        border: "#C8EBDD",
        text: colors.success,
        icon: "circle-check",
      };

    case "rejected":
      return {
        background: "#FFF2F1",
        border: "#F4CECB",
        text: colors.error,
        icon: "circle-x",
      };

    case "replacement_requested":
      return {
        background: colors.gold[50],
        border: colors.gold[100],
        text: colors.warning,
        icon: "refresh-cw",
      };

    case "escalated":
      return {
        background: "#FFF8E6",
        border: "#ECD79D",
        text: "#8A6508",
        icon: "flag",
      };

    case "under_review":
      return {
        background: "#EEF5FF",
        border: "#D9E9FD",
        text: colors.info,
        icon: "search",
      };

    case "flagged":
      return {
        background: colors.gold[50],
        border: colors.gold[100],
        text: colors.warning,
        icon: "alert-triangle",
      };

    default:
      return {
        background: "#FFF8E8",
        border: "#F2E3B9",
        text: colors.warning,
        icon: "clock",
      };
  }
}

export function statusLabel(status: string) {
  if (status === "assigned") {
    return "Pending validation";
  }

  if (status === "replacement_requested") {
    return "Replacement requested";
  }

  return formatLabel(status);
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tone.background,
          borderColor: tone.border,
        },
      ]}
    >
      <AppIcon name={tone.icon} color={tone.text} size={iconSizes.xs} />

      <Text style={[styles.badgeText, { color: tone.text }]}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

export function DecisionBadge({ decision }: { decision: EvidenceDecision }) {
  return <StatusBadge status={decision} />;
}

export function PriorityBadge({ priority }: { priority: EvidencePriority }) {
  const critical = priority === "urgent";
  const high = priority === "high";

  const color = critical
    ? colors.error
    : high
      ? colors.warning
      : colors.navy[600];

  const background = critical ? "#FFF2F1" : high ? "#FFF8E8" : colors.navy[50];

  const border = critical ? "#F4CECB" : high ? "#F2E3B9" : colors.navy[100];

  const label = critical
    ? "Critical priority"
    : `${formatLabel(priority)} priority`;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: background,
          borderColor: border,
        },
      ]}
    >
      <View style={[styles.priorityDot, { backgroundColor: color }]} />

      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function FilterChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function QueueTab({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.queueTab,
        selected && styles.queueTabSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.queueTabText, selected && styles.queueTabTextSelected]}
      >
        {label}
      </Text>

      <Text
        style={[styles.queueTabCount, selected && styles.queueTabCountSelected]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

export function EvidenceQueueCard({
  item,
  onPress,
  flagged = false,
}: {
  item: ValidatorEvidenceItem;
  onPress: () => void;
  flagged?: boolean;
}) {
  const status = flagged ? "flagged" : item.assignmentStatus;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.fileName || item.evidenceTitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.evidenceCard,
        cardShadow,
        pressed && styles.evidenceCardPressed,
      ]}
    >
      <View style={styles.evidenceRow}>
        <View style={styles.fileIconBox}>
          <AppIcon
            name={evidenceIconName(item.evidenceType)}
            color={colors.navy[600]}
            size={iconSizes.md}
          />
        </View>

        <View style={styles.evidenceContent}>
          <View style={styles.referenceRow}>
            <Text style={styles.evidenceId} numberOfLines={1}>
              {shortEvidenceId(item.evidenceId)}

              <Text style={styles.caseReference}> · {item.caseReference}</Text>
            </Text>

            <AppIcon name="chevron-right" color={colors.navy[300]} size={iconSizes.sm} />
          </View>

          <Text style={styles.fileName} numberOfLines={1}>
            {item.fileName || item.evidenceTitle}
          </Text>

          <Text style={styles.fileMeta} numberOfLines={1}>
            {formatLabel(item.evidenceType)} · {formatBytes(item.fileSizeBytes)}{" "}
            · assigned {formatDateTime(item.assignedAt || item.evidenceCreatedAt)}
          </Text>

          <View style={styles.badgeRow}>
            <StatusBadge status={status} />

            <PriorityBadge priority={item.casePriority} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function HistoryDecisionCard({
  item,
}: {
  item: VerificationHistoryItem;
}) {
  return (
    <View style={[styles.historyCard, cardShadow]}>
      <View style={styles.historyTop}>
        <View style={styles.historyHeading}>
          <Text style={styles.evidenceId}>
            {shortEvidenceId(item.evidenceId)}
          </Text>

          <Text style={styles.historyCase}>{item.caseReference}</Text>
        </View>

        <DecisionBadge decision={item.decision} />
      </View>

      <Text style={styles.historyTitle} numberOfLines={1}>
        {item.fileName || item.evidenceTitle}
      </Text>

      <Text style={styles.historyReason}>{item.reason}</Text>

      <View style={styles.historyFooter}>
        <Text style={styles.historyDate}>{formatDateTime(item.decidedAt)}</Text>

        <Text style={styles.readOnly}>Audit record</Text>
      </View>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={colors.royal[700]} />

      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <View style={styles.errorCard}>
      <AppIcon name="alert-triangle" color={colors.error} size={iconSizes.md} />

      <View style={styles.stateCopy}>
        <Text style={styles.errorTitle}>Unable to load this screen</Text>

        <Text style={styles.errorMessage}>{message}</Text>
      </View>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={[styles.emptyCard, cardShadow]}>
      <View style={styles.emptyIconBox}>
        <AppIcon name="file-search" color={colors.navy[500]} size={iconSizes.lg} />
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function shortEvidenceId(value: string) {
  if (/^EV-/i.test(value)) {
    return value;
  }

  return `EV-${value.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatBytes(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Unknown size";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatShortDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function evidenceIconName(type: string): AppIconName {
  switch (type.toLowerCase()) {
    case "image":
    case "photo":
      return "image";

    case "audio":
      return "mic";

    case "video":
      return "video";

    default:
      return "file-text";
  }
}

export const cardShadow: ViewStyle = {
  shadowColor: colors.navy[900],
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.66,
  },

  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },

  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },

  headerSpacer: {
    width: 38,
  },

  sectionCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },

  sectionDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  sectionBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  detailRow: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  detailRowLast: {
    borderBottomWidth: 0,
  },

  detailLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },

  detailValue: {
    flex: 1.35,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    color: colors.navy[800],
  },

  badge: {
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 8,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  filterChip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },

  filterChipSelected: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
  },

  filterChipTextSelected: {
    fontWeight: "600",
    color: colors.surface,
  },

  queueTab: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    backgroundColor: colors.surface,
  },

  queueTabSelected: {
    borderColor: colors.navy[800],
    backgroundColor: colors.navy[800],
  },

  queueTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[700],
  },

  queueTabTextSelected: {
    color: colors.surface,
  },

  queueTabCount: {
    fontSize: 12,
    color: colors.textSoft,
  },

  queueTabCountSelected: {
    color: colors.navy[100],
  },

  evidenceCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  evidenceCardPressed: {
    borderColor: colors.royal[200],
    backgroundColor: colors.royal[50],
  },

  evidenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  fileIconBox: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },

  evidenceContent: {
    flex: 1,
    minWidth: 0,
  },

  referenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  evidenceId: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.royal[700],
  },

  caseReference: {
    fontWeight: "500",
    color: colors.textSoft,
  },

  fileName: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },

  fileMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  badgeRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  historyCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  historyTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  historyHeading: {
    flex: 1,
  },

  historyCase: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSoft,
  },

  historyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },

  historyReason: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  historyFooter: {
    marginTop: 11,
    paddingTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  historyDate: {
    fontSize: 11,
    color: colors.textSoft,
  },

  readOnly: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.royal[700],
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: colors.background,
  },

  loadingLabel: {
    marginTop: 12,
    fontSize: 12.5,
    color: colors.textSecondary,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F4CECB",
    borderRadius: 12,
    backgroundColor: "#FFF2F1",
  },

  stateCopy: {
    flex: 1,
  },

  errorTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.error,
  },

  errorMessage: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  emptyIconBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.navy[50],
  },

  emptyTitle: {
    marginTop: 11,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },

  emptyBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: colors.textSecondary,
  },
});
