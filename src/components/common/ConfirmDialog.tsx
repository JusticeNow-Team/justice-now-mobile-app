import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "../AppIcon";
import { colors } from "../../theme";
import PrimaryButton from "./PrimaryButton";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
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
            <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
              <AppIcon
                name={danger ? "alert-triangle" : "info"}
                size={16}
                color={danger ? colors.errorStrong : colors.royal[700]}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              style={styles.close}
            >
              <AppIcon
                name="x"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <View style={styles.action}>
              <PrimaryButton
                title={cancelLabel}
                variant="outline"
                onPress={onClose}
                disabled={loading}
              />
            </View>
            <View style={styles.action}>
              <PrimaryButton
                title={confirmLabel}
                variant={danger ? "destructive" : "primary"}
                onPress={onConfirm}
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
    backgroundColor: colors.royal[50],
  },
  iconWrapDanger: {
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
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
