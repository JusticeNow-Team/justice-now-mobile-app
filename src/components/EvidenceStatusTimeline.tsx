import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { EvidenceStatus, StatusHistoryRecord } from "../checker/types";
import { colors, iconSizes } from "../theme";
import { AppIcon, AppIconName } from "./AppIcon";

interface EvidenceStatusTimelineProps {
  currentStatus: EvidenceStatus;
  statusHistory?: StatusHistoryRecord[];
  lastChangedAt?: string;
}

const STEPS: { key: EvidenceStatus; label: string; icon: AppIconName }[] = [
  { key: "pending", label: "Pending Intake", icon: "clock" },
  { key: "under_review", label: "Under Examination", icon: "search" },
  { key: "validated", label: "Validated & Case-Linked", icon: "check" },
];

export function EvidenceStatusTimeline({
  currentStatus,
  statusHistory = [],
}: EvidenceStatusTimelineProps) {
  const isRejected = currentStatus === "rejected";
  const isInfoRequested = currentStatus === "info_requested";
  const isArchived = currentStatus === "archived";

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <AppIcon name="activity" size={iconSizes.sm} color={colors.textPrimary} />
        <Text style={styles.sectionHeaderTitle}>Status Progression Tracker</Text>
      </View>

      <View style={styles.trackerRow}>
        {STEPS.map((step, idx) => {
          let isCompleted = false;
          const isActive = currentStatus === step.key;

          if (currentStatus === "validated") {
            isCompleted = true;
          } else if (currentStatus === "under_review" && step.key === "pending") {
            isCompleted = true;
          }

          const iconName: AppIconName =
            isRejected && isActive
              ? "x"
              : isInfoRequested && isActive
                ? "circle-help"
                : isCompleted
                  ? "check"
                  : step.icon;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepBox}>
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                    isActive && styles.stepCircleActive,
                    isRejected && isActive && styles.stepCircleRejected,
                    isInfoRequested && isActive && styles.stepCircleInfo,
                  ]}
                >
                  <AppIcon name={iconName} size={iconSizes.sm} color={colors.textPrimary} />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (isCompleted || isActive) && styles.stepLabelActive,
                  ]}
                >
                  {isRejected && isActive
                    ? "Rejected"
                    : isInfoRequested && isActive
                      ? "Info Requested"
                      : step.label}
                </Text>
              </View>

              {idx < STEPS.length - 1 ? (
                <View
                  style={[
                    styles.stepConnector,
                    isCompleted && styles.stepConnectorCompleted,
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      {isRejected ? (
        <View style={styles.rejectedBanner}>
          <AppIcon
            name="x"
            size={iconSizes.sm}
            color={colors.error}
            style={styles.bannerIcon}
          />
          <Text style={styles.bannerText}>
            Status: Rejected / Non-Compliant. Record flagged for checker audit.
          </Text>
        </View>
      ) : null}

      {isInfoRequested ? (
        <View style={styles.infoBanner}>
          <AppIcon
            name="circle-help"
            size={16}
            color="#D97706"
            style={styles.bannerIcon}
          />
          <Text style={styles.bannerText}>
            Status: Action Required. Waiting for reporter/officer metadata response.
          </Text>
        </View>
      ) : null}

      {isArchived ? (
        <View style={styles.archivedBanner}>
          <AppIcon
            name="document"
            size={iconSizes.sm}
            color={colors.textSecondary}
            style={styles.bannerIcon}
          />
          <Text style={styles.bannerText}>
            Status: Case Archived. Terminal read-only state.
          </Text>
        </View>
      ) : null}

      <View style={styles.historyHeaderRow}>
        <View style={styles.sectionHeader}>
          <AppIcon name="history" size={iconSizes.sm} color={colors.textPrimary} />
          <Text style={styles.sectionHeaderTitle}>Status Change History Trail</Text>
        </View>
        <Text style={styles.historyCountBadge}>{statusHistory.length} event(s)</Text>
      </View>

      {statusHistory.length === 0 ? (
        <View style={styles.emptyHistoryBox}>
          <Text style={styles.emptyHistoryText}>
            No status transition logs recorded yet. Newly uploaded evidence starts as Pending.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {statusHistory.map((item, index) => {
            const dateStr = item.changedAt
              ? new Date(item.changedAt).toLocaleString([], {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A";

            return (
              <View key={item.id || index} style={styles.timelineCard}>
                <View style={styles.timelineCardHeader}>
                  <View style={styles.transitionBadgeRow}>
                    <Text style={styles.statusFromText}>{item.fromStatus}</Text>
                    <AppIcon name="arrow-right" size={iconSizes.xs} color={colors.textSoft} />
                    <StatusPill status={item.toStatus} />
                  </View>

                  <Text style={styles.timelineDateText}>{dateStr}</Text>
                </View>

                <View style={styles.timelineRoleRow}>
                  <RoleLabel role={item.changedByRole} />
                  {item.changedByName ? (
                    <Text style={styles.actingUserText}>({item.changedByName})</Text>
                  ) : null}
                </View>

                {item.notes ? <Text style={styles.timelineNotesText}>{item.notes}</Text> : null}

                {item.rejectionReason ? (
                  <View style={styles.rejectionReasonBox}>
                    <Text style={styles.rejectionReasonText}>
                      Rejection Reason: {item.rejectionReason}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function RoleLabel({ role }: { role: StatusHistoryRecord["changedByRole"] }) {
  let icon: AppIconName = "user";
  let label = "Reporter";

  if (role === "checker") {
    icon = "shield";
    label = "Evidence Checker";
  } else if (role === "case_officer") {
    icon = "balance";
    label = "Case Officer";
  } else if (role === "system") {
    icon = "settings";
    label = "System Intake";
  }

  return (
    <View style={styles.roleBadgeRow}>
      <AppIcon name={icon} size={iconSizes.xs} color={colors.textPrimary} />
      <Text style={styles.roleBadgeText}>{label}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: EvidenceStatus }) {
  let bg = "#FEF3C7";
  let fg = "#92400E";
  let label = status;

  if (status === "under_review") {
    bg = "#E0F2FE";
    fg = "#0369A1";
    label = "under_review";
  } else if (status === "validated") {
    bg = "#D1FAE5";
    fg = "#065F46";
    label = "validated";
  } else if (status === "rejected") {
    bg = "#FEE2E2";
    fg = "#991B1B";
    label = "rejected";
  } else if (status === "info_requested") {
    bg = "#FEF9C3";
    fg = "#854D0E";
    label = "info_requested";
  } else if (status === "archived") {
    bg = "#F1F5F9";
    fg = "#475569";
    label = "archived";
  }

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  trackerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  stepBox: {
    alignItems: "center",
    zIndex: 2,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  stepCircleCompleted: {
    backgroundColor: "#D1FAE5",
    borderColor: "#059669",
  },
  stepCircleRejected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#DC2626",
  },
  stepCircleInfo: {
    backgroundColor: "#FEF9C3",
    borderColor: "#D97706",
  },
  stepLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 4,
    marginTop: -16,
  },
  stepConnectorCompleted: {
    backgroundColor: "#059669",
  },
  rejectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF9C3",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
  },
  archivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#475569",
  },
  bannerIcon: {
    marginRight: 8,
  },
  bannerText: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "600",
    flex: 1,
  },
  historyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  historyCountBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyHistoryBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  emptyHistoryText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  timelineList: {
    gap: 10,
  },
  timelineCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timelineCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  transitionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusFromText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  timelineDateText: {
    fontSize: 11,
    color: "#64748B",
  },
  timelineRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  roleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  actingUserText: {
    fontSize: 11,
    color: "#64748B",
  },
  timelineNotesText: {
    fontSize: 12,
    color: "#334155",
    marginTop: 2,
  },
  rejectionReasonBox: {
    marginTop: 6,
    backgroundColor: "#FEF2F2",
    padding: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#DC2626",
  },
  rejectionReasonText: {
    fontSize: 11.5,
    color: "#991B1B",
    fontWeight: "600",
  },
});
