import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppIcon } from "../../components/AppIcon";
import { AppTextArea, Field, PrimaryButton } from "../../components/common";
import { colors } from "../../theme";

interface WithdrawalRequestDialogProps {
  visible: boolean;
  caseReference?: string;
  loading?: boolean;
  error?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function WithdrawalRequestDialog({
  visible,
  caseReference,
  loading = false,
  error,
  onConfirm,
  onClose,
}: WithdrawalRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setReason("");
        setLocalError("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleConfirm = () => {
    const trimmed = reason.trim();

    if (trimmed.length < 10) {
      setLocalError(
        "Please explain why you want to withdraw this case (at least 10 characters)."
      );
      return;
    }

    setLocalError("");
    onConfirm(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityRole="alert">
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <AppIcon
                name="alert-triangle"
                size={16}
                color={colors.errorStrong}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Request case withdrawal?</Text>
              <Text style={styles.body}>
                {caseReference
                  ? `This asks staff to stop work on ${caseReference}. `
                  : "This asks staff to stop work on this case. "}
                Your reason is required and will be shared with the assigned
                investigator or an administrator.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              disabled={loading}
              style={styles.close}
            >
              <AppIcon name="x" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Field
              label="Withdrawal reason"
              hint="Tell us why you want this case withdrawn."
              error={localError || error}
            >
              <AppTextArea
                value={reason}
                onChangeText={(value) => {
                  setLocalError("");
                  setReason(value.slice(0, 1000));
                }}
                editable={!loading}
                placeholder="Type your reason…"
                style={styles.reasonInput}
              />
            </Field>
            <Text style={styles.counter}>{reason.length} / 1000 characters</Text>
          </View>

          <View style={styles.actions}>
            <View style={styles.action}>
              <PrimaryButton
                title="Keep case open"
                variant="outline"
                onPress={onClose}
                disabled={loading}
              />
            </View>
            <View style={styles.action}>
              <PrimaryButton
                title="Request withdrawal"
                variant="destructive"
                onPress={handleConfirm}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 30, 51, 0.45)",
    justifyContent: "center",
    padding: 24,
  },
  panel: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF2F1",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  body: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  close: {
    marginTop: -4,
    marginRight: -4,
    padding: 6,
  },
  field: {
    marginTop: 16,
  },
  reasonInput: {
    minHeight: 110,
  },
  counter: {
    marginTop: 6,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
