import { StyleSheet, Text, View } from "react-native";

import { AppIcon, AppIconName } from "../AppIcon";
import { colors } from "../../theme";
import PrimaryButton from "./PrimaryButton";

interface EmptyStateProps {
  icon?: AppIconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = "folder-open",
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.box}>
      <View style={styles.iconWrap}>
        <AppIcon name={icon} size={24} color={colors.navy[700]} />
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
