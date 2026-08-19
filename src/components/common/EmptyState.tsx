import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";
import PrimaryButton from "./PrimaryButton";

interface EmptyStateProps {
  icon?: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = "📁",
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.box}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy[50],
  },
  icon: {
    fontSize: 24,
  },
  title: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },
  body: {
    marginTop: 6,
    maxWidth: 260,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  action: {
    marginTop: 16,
    alignSelf: "stretch",
  },
});
