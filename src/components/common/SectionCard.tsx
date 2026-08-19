import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}

export default function SectionCard({
  title,
  description,
  action,
  children,
  padded = true,
}: SectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
        </View>
        {action}
      </View>
      <View style={padded ? styles.body : undefined}>{children}</View>
    </View>
  );
}

interface DataRowProps {
  label: string;
  value: string;
  last?: boolean;
}

export function DataRow({ label, value, last = false }: DataRowProps) {
  return (
    <View style={[styles.dataRow, !last && styles.dataRowBorder]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    shadowColor: "#0F1E33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  description: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
  },
  dataRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.7)",
  },
  dataLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  dataValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy[800],
  },
});
