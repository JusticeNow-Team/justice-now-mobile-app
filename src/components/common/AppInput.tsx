import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { colors, spacing, typography } from "../../theme";

interface AppInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export default function AppInput({
  label,
  error,
  ...props
}: AppInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : undefined,
        ]}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        {...props}
      />

      {error ? (
        <Text
          style={styles.error}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },

  label: {
    ...typography.small,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },

  inputError: {
    borderColor: colors.error,
  },

  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});