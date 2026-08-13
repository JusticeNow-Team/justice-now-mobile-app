import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  spacing,
  typography,
} from "../../theme";

import StatusBadge, {
  StatusType,
} from "./StatusBadge";

interface CaseCardProps {
  caseId: string;
  title: string;
  category: string;
  status: StatusType;
  lastUpdated: string;
  onPress?: () => void;
}

export default function CaseCard({
  caseId,
  title,
  category,
  status,
  lastUpdated,
  onPress,
}: CaseCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caseId}, ${title}, ${status}`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.caseId}>
          {caseId}
        </Text>

        <StatusBadge status={status} />
      </View>

      <Text style={styles.title}>
        {title}
      </Text>

      <Text style={styles.category}>
        {category}
      </Text>

      <Text style={styles.updated}>
        Last updated: {lastUpdated}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,

    borderWidth: 1,
    borderColor: colors.border,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,

    elevation: 2,
  },

  pressed: {
    opacity: 0.9,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },

  caseId: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },

  category: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  updated: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});