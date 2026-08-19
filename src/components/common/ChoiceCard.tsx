import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface ChoiceCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}

export default function ChoiceCard({
  title,
  description,
  selected,
  onPress,
  multi = false,
}: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.control, multi ? styles.box : styles.radio, selected && styles.controlSelected]}>
        {selected ? <Text style={styles.mark}>{multi ? "✓" : ""}</Text> : null}
        {selected && !multi ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.royal[500],
    backgroundColor: colors.royal[50],
  },
  control: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: colors.navy[300],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  box: {
    borderRadius: 6,
  },
  radio: {
    borderRadius: 10,
  },
  controlSelected: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },
  mark: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textInverse,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textInverse,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
