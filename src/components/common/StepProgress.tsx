import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface StepProgressProps {
  current: number;
  total: number;
  label: string;
}

export default function StepProgress({ current, total, label }: StepProgressProps) {
  const pct = Math.round((current / total) * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.meta}>
          Step {current} of {total}
          <Text style={styles.label}> · {label}</Text>
        </Text>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <View style={styles.bars} accessibilityRole="progressbar">
        {Array.from({ length: total }, (_, index) => {
          const step = index + 1;
          const fill =
            step < current
              ? colors.teal[500]
              : step === current
                ? colors.royal[600]
                : colors.navy[100];

          return <View key={step} style={[styles.bar, { backgroundColor: fill }]} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  label: {
    fontWeight: "500",
    color: colors.textSecondary,
  },
  pct: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.royal[700],
  },
  bars: {
    marginTop: 8,
    flexDirection: "row",
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 99,
  },
});
