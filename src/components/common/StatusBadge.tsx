import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../theme";

export type StatusType =
  | "submitted"
  | "underReview"
  | "investigation"
  | "awaitingInformation"
  | "resolved"
  | "escalated"
  | "closed"
  | "pending"
  | "validated"
  | "rejected";

interface StatusBadgeProps {
  status: StatusType;
}

const statusConfig = {
  submitted: {
    label: "Submitted",
    color: colors.info,
    background: "#E8F1FB",
  },

  underReview: {
    label: "Under Review",
    color: colors.primaryLight,
    background: "#E7F0FA",
  },

  investigation: {
    label: "Investigation",
    color: colors.primary,
    background: "#E4EBF3",
  },

  awaitingInformation: {
    label: "Awaiting Information",
    color: colors.warning,
    background: "#FFF4D9",
  },

  resolved: {
    label: "Resolved",
    color: colors.success,
    background: "#E5F4EB",
  },

  escalated: {
    label: "Escalated",
    color: colors.error,
    background: "#FBEAEA",
  },

  closed: {
    label: "Closed",
    color: colors.textSecondary,
    background: "#EEF0F2",
  },

  pending: {
    label: "Pending",
    color: colors.warning,
    background: "#FFF4D9",
  },

  validated: {
    label: "Validated",
    color: colors.success,
    background: "#E5F4EB",
  },

  rejected: {
    label: "Rejected",
    color: colors.error,
    background: "#FBEAEA",
  },
};

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.background },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: config.color },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});