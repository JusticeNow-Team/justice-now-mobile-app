import { StyleSheet, Text, View } from "react-native";

import { AppIcon } from "../../components/AppIcon";
import { colors } from "../../theme";

interface PasswordRulesProps {
  rules: { label: string; met: boolean }[];
}

export default function PasswordRules({ rules }: PasswordRulesProps) {
  return (
    <View style={styles.list}>
      {rules.map((rule) => (
        <View key={rule.label} style={styles.row}>
          <View style={styles.icon}>
            <AppIcon
              name={rule.met ? "check" : "circle"}
              size={12}
              color={rule.met ? colors.success : colors.navy[200]}
              strokeWidth={rule.met ? 3 : 2}
            />
          </View>
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
    alignItems: "center",
    justifyContent: "center",
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
