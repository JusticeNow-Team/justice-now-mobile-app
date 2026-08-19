import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";
import { formatCaseDate, formatCaseDateTime } from "./filterReporterCases";
import ReporterStatusBadge from "./ReporterStatusBadge";
import { ReporterCase } from "./types";

export default function ReporterCaseCard({
  record,
}: {
  record: ReporterCase;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.reference}>{record.caseReference}</Text>
        <ReporterStatusBadge status={record.status} />
      </View>
      <Text style={styles.title}>{record.title}</Text>
      <Text style={styles.category}>{record.category || "Uncategorised"}</Text>
      <Text style={styles.meta}>📅  {formatCaseDate(record.incidentDate || record.createdAt)}</Text>
      <View style={styles.footer}>
        <Text style={styles.update} numberOfLines={1}>
          <Text style={styles.updateLabel}>Last update: </Text>
          {formatCaseDateTime(record.updatedAt)}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </View>
  );
}

interface PressableCardProps {
  record: ReporterCase;
  onPress?: () => void;
}

export function PressableReporterCaseCard({
  record,
  onPress,
}: PressableCardProps) {
  if (!onPress) {
    return <ReporterCaseCard record={record} />;
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <ReporterCaseCard record={record} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reference: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.royal[700],
  },
  title: {
    marginTop: 8,
    fontSize: 14.5,
    fontWeight: "600",
    lineHeight: 20,
    color: colors.navy[800],
  },
  category: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  meta: {
    marginTop: 10,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  update: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  updateLabel: {
    fontWeight: "600",
    color: colors.navy[700],
  },
  chevron: {
    fontSize: 20,
    color: colors.navy[300],
  },
});
