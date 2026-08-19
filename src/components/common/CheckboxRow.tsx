import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface CheckboxRowProps {
  checked: boolean;
  onPress: () => void;
  label: string;
  hint?: string;
}

export default function CheckboxRow({
  checked,
  onPress,
  label,
  hint,
}: CheckboxRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  box: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.navy[300],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  boxChecked: {
    backgroundColor: colors.royal[700],
    borderColor: colors.royal[700],
  },
  checkmark: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textInverse,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    color: colors.navy[800],
  },
  hint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});
