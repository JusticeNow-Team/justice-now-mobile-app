import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { colors, spacing, typography } from "../../theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "destructive";
  icon?: string;
  style?: ViewStyle;
}

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  icon,
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.button,
        variant === "outline" && styles.outline,
        variant === "destructive" && styles.destructive,
        pressed && !isDisabled && styles.pressed,
        isDisabled &&
          (variant === "outline" ? styles.outlineDisabled : styles.disabled),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "outline" ? colors.navy[700] : colors.textInverse
          }
        />
      ) : (
        <>
          {icon ? (
            <Text
              style={[
                styles.icon,
                variant === "outline" && styles.outlineText,
                variant === "destructive" && styles.destructiveText,
              ]}
            >
              {icon}
            </Text>
          ) : null}
          <Text
            style={[
              styles.text,
              variant === "outline" && styles.outlineText,
              variant === "destructive" && styles.destructiveText,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.navy[200],
  },

  destructive: {
    backgroundColor: colors.surface,
    borderColor: "#F4C7C3",
  },

  pressed: {
    opacity: 0.85,
  },

  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },

  outlineDisabled: {
    backgroundColor: colors.navy[50],
    borderColor: colors.border,
  },

  text: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textInverse,
  },

  outlineText: {
    color: colors.navy[700],
  },

  destructiveText: {
    color: colors.errorStrong,
  },

  icon: {
    fontSize: 16,
    color: colors.textInverse,
  },
});