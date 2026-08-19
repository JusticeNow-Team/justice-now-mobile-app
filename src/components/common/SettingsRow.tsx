import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface SettingsRowProps {
  label: string;
  hint?: string;
  value?: string;
  icon?: string;
  danger?: boolean;
  last?: boolean;
  onPress: () => void;
}

export default function SettingsRow({
  label,
  hint,
  value,
  icon,
  danger = false,
  last = false,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      {value ? <Text style={styles.value}>{value}</Text> : null}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.7)",
  },
  pressed: {
    backgroundColor: "rgba(238, 243, 250, 0.6)",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  iconWrapDanger: {
    backgroundColor: "#FFF2F1",
  },
  icon: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  labelDanger: {
    color: colors.errorStrong,
  },
  hint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 22,
    color: colors.navy[300],
  },
});
