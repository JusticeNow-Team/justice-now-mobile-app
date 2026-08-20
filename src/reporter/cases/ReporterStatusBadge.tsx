import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";
import { ReporterCaseStatus } from "./types";

const labels: Record<
  ReporterCaseStatus,
  {
    label: string;
    color: string;
    background: string;
  }
> = {
  submitted: {
    label: "Submitted",
    color: colors.info,
    background: "#E8F1FB",
  },
  under_review: {
    label: "Under review",
    color: colors.royal[600],
    background: "#EFF4FF",
  },
  assigned: {
    label: "Assigned",
    color: colors.royal[700],
    background: "#EFF4FF",
  },
  investigating: {
    label: "Investigating",
    color: colors.navy[700],
    background: colors.navy[50],
  },
  awaiting_information: {
    label: "Awaiting information",
    color: colors.warning,
    background: "#FBF7EC",
  },
  awaiting_evidence: {
    label: "Awaiting evidence",
    color: colors.warning,
    background: "#FBF7EC",
  },
  resolved: {
    label: "Resolved",
    color: colors.success,
    background: "#EAF8F2",
  },
  closed: {
    label: "Closed",
    color: colors.textSecondary,
    background: colors.navy[50],
  },
};

export default function ReporterStatusBadge({
  status,
}: {
  status: ReporterCaseStatus;
}) {
  const config = labels[status];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.background,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.color,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
