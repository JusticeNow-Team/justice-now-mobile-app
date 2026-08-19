import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface PasswordRulesProps {
  rules: { label: string; met: boolean }[];
}

export default function PasswordRules({ rules }: PasswordRulesProps) {
  return (
    <View style={styles.list}>
      {rules.map((rule) => (
        <View key={rule.label} style={styles.row}>
          <Text style={[styles.icon, rule.met && styles.iconMet]}>
            {rule.met ? "✓" : "○"}
          </Text>
          <Text style={[styles.label, rule.met && styles.labelMet]}>
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 4,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 16,
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[200],
  },
  iconMet: {
    color: colors.success,
  },
  label: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  labelMet: {
    color: colors.success,
  },
});
