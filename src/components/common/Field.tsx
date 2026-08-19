import { ReactNode, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { colors } from "../../theme";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, error, optional, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> · optional</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : <View style={styles.hintSpacer} />}
      {children}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          ⚠ {error}
        </Text>
      ) : null}
    </View>
  );
}

interface AppTextInputProps extends TextInputProps {
  invalid?: boolean;
}

export function AppTextInput({
  invalid,
  style,
  onFocus,
  onBlur,
  ...props
}: AppTextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textSoft}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.textInput,
        focused && !invalid && styles.inputFocused,
        invalid && styles.inputInvalid,
        style,
      ]}
    />
  );
}

export function AppTextArea({
  invalid,
  style,
  onFocus,
  onBlur,
  ...props
}: AppTextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      multiline
      textAlignVertical="top"
      placeholderTextColor={colors.textSoft}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.textInput,
        styles.textArea,
        focused && !invalid && styles.inputFocused,
        invalid && styles.inputInvalid,
        style,
      ]}
    />
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  accessibilityLabel?: string;
}

export function SelectInput({
  value,
  options,
  onChange,
  accessibilityLabel,
}: SelectInputProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.select}
      >
        <Text style={styles.selectValue}>{selected?.label ?? ""}</Text>
        <Text style={styles.selectChevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalCard}>
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  optional: {
    fontWeight: "500",
    color: colors.textSoft,
  },
  hint: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  hintSpacer: {
    height: 6,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500",
    color: colors.errorStrong,
  },
  textInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    fontSize: 14,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 140,
    paddingTop: 12,
  },
  select: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputFocused: {
    borderColor: colors.royal[500],
  },
  inputInvalid: {
    borderColor: colors.error,
  },
  selectValue: {
    flex: 1,
    fontSize: 14,
    color: colors.navy[800],
    paddingRight: 8,
  },
  selectChevron: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 30, 51, 0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionRowSelected: {
    backgroundColor: colors.royal[50],
  },
  optionText: {
    fontSize: 14,
    color: colors.navy[800],
  },
  optionTextSelected: {
    fontWeight: "600",
    color: colors.royal[700],
  },
});
