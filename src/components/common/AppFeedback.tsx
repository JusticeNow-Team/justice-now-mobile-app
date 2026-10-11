import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AlertButton,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../AppIcon";
import { colors } from "../../theme";
import { shadows } from "../../theme/shadows";
import PrimaryButton from "./PrimaryButton";

export type AppFeedbackTone = "success" | "error" | "warning" | "info";

export type AppFeedbackMessage = {
  tone?: AppFeedbackTone;
  title: string;
  message?: string;
  durationMs?: number;
};

export type AppConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type AppFeedbackContextValue = {
  showFeedback: (message: AppFeedbackMessage) => void;
  hideFeedback: () => void;
  confirm: (options: AppConfirmOptions) => Promise<boolean>;
};

type AppAlertRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);

let externalShowFeedback: ((message: AppFeedbackMessage) => void) | null = null;

const toneConfig: Record<
  AppFeedbackTone,
  {
    icon: AppIconName;
    iconColor: string;
    borderColor: string;
    backgroundColor: string;
  }
> = {
  success: {
    icon: "check-circle",
    iconColor: colors.success,
    borderColor: "#B7E4D4",
    backgroundColor: "#F0FBF6",
  },
  error: {
    icon: "alert-circle",
    iconColor: colors.errorStrong,
    borderColor: "#F4C7C3",
    backgroundColor: "#FFF2F1",
  },
  warning: {
    icon: "warning",
    iconColor: colors.warning,
    borderColor: colors.gold[200],
    backgroundColor: colors.gold[50],
  },
  info: {
    icon: "info",
    iconColor: colors.info,
    borderColor: colors.royal[100],
    backgroundColor: colors.royal[50],
  },
};

export function showAppFeedback(message: AppFeedbackMessage) {
  externalShowFeedback?.(message);
}

export function useAppFeedback() {
  const context = useContext(AppFeedbackContext);

  if (!context) {
    throw new Error("useAppFeedback must be used inside AppFeedbackProvider");
  }

  return context;
}

export function useAppConfirm() {
  const context = useAppFeedback();

  return {
    confirm: context.confirm,
  };
}

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<AppFeedbackMessage | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<AppConfirmOptions | null>(
    null,
  );
  const [alertRequest, setAlertRequest] = useState<AppAlertRequest | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const hideFeedback = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    setCurrent(null);
  }, []);

  const showFeedback = useCallback(
    (message: AppFeedbackMessage) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      setCurrent({
        tone: "info",
        durationMs: 4200,
        ...message,
      });

      hideTimer.current = setTimeout(() => {
        setCurrent(null);
        hideTimer.current = null;
      }, message.durationMs ?? 4200);
    },
    [],
  );

  const confirm = useCallback((options: AppConfirmOptions) => {
    confirmResolver.current?.(false);

    setConfirmRequest({
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      danger: false,
      ...options,
    });

    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const closeConfirm = useCallback((confirmed: boolean) => {
    confirmResolver.current?.(confirmed);
    confirmResolver.current = null;
    setConfirmRequest(null);
  }, []);

  const closeAppAlert = useCallback((button?: AlertButton) => {
    setAlertRequest(null);
    button?.onPress?.();
  }, []);

  useEffect(() => {
    externalShowFeedback = showFeedback;

    return () => {
      if (externalShowFeedback === showFeedback) {
        externalShowFeedback = null;
      }
    };
  }, [showFeedback]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    const originalAlert = window.alert;

    window.alert = (value?: unknown) => {
      const text = String(value ?? "");
      const [title, body] = splitAlertText(text);

      showFeedback({
        tone: inferTone(title),
        title: title || "Notice",
        message: body || undefined,
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showFeedback]);

  useEffect(() => {
    const originalAlert = Alert.alert;

    Alert.alert = ((title, message, buttons) => {
      const alertTitle = String(title || "Notice");
      const alertMessage =
        typeof message === "string"
          ? message
          : message == null
            ? undefined
            : String(message);
      const normalizedButtons =
        buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
      const isSimpleDismiss =
        normalizedButtons.length === 1 &&
        !normalizedButtons[0].onPress &&
        (normalizedButtons[0].text ?? "OK").toLowerCase() === "ok";

      if (isSimpleDismiss) {
        showFeedback({
          tone: inferTone(alertTitle),
          title: alertTitle,
          message: alertMessage,
        });
        return;
      }

      setAlertRequest({
        title: alertTitle,
        message: alertMessage,
        buttons: normalizedButtons,
      });
    }) as typeof Alert.alert;

    return () => {
      Alert.alert = originalAlert;
    };
  }, [showFeedback]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      confirmResolver.current?.(false);
    };
  }, []);

  const value = useMemo(
    () => ({
      showFeedback,
      hideFeedback,
      confirm,
    }),
    [confirm, hideFeedback, showFeedback],
  );

  const selected = toneConfig[current?.tone ?? "info"];

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}
      <Modal
        visible={Boolean(confirmRequest)}
        transparent
        animationType="fade"
        onRequestClose={() => closeConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmPanel} accessibilityRole="alert">
            <View
              style={[
                styles.confirmIcon,
                confirmRequest?.danger && styles.confirmIconDanger,
              ]}
            >
              <AppIcon
                name={confirmRequest?.danger ? "alert-triangle" : "info"}
                size={20}
                color={
                  confirmRequest?.danger
                    ? colors.errorStrong
                    : colors.royal[700]
                }
              />
            </View>

            <Text style={styles.confirmTitle}>{confirmRequest?.title}</Text>
            <Text style={styles.confirmMessage}>{confirmRequest?.message}</Text>

            <View style={styles.confirmActions}>
              <View style={styles.confirmAction}>
                <PrimaryButton
                  title={confirmRequest?.cancelLabel ?? "Cancel"}
                  variant="outline"
                  onPress={() => closeConfirm(false)}
                />
              </View>
              <View style={styles.confirmAction}>
                <PrimaryButton
                  title={confirmRequest?.confirmLabel ?? "OK"}
                  variant={confirmRequest?.danger ? "destructive" : "primary"}
                  onPress={() => closeConfirm(true)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(alertRequest)}
        transparent
        animationType="fade"
        onRequestClose={() => closeAppAlert()}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmPanel} accessibilityRole="alert">
            <View style={styles.confirmIcon}>
              <AppIcon
                name={toneConfig[inferTone(alertRequest?.title ?? "")].icon}
                size={20}
                color={toneConfig[inferTone(alertRequest?.title ?? "")].iconColor}
              />
            </View>

            <Text style={styles.confirmTitle}>{alertRequest?.title}</Text>
            {alertRequest?.message ? (
              <Text style={styles.confirmMessage}>{alertRequest.message}</Text>
            ) : null}

            <View style={styles.alertActions}>
              {(alertRequest?.buttons ?? [{ text: "OK" }]).map(
                (button, index) => {
                  const isDestructive = button.style === "destructive";
                  const isCancel = button.style === "cancel";

                  return (
                    <Pressable
                      key={`${button.text ?? "OK"}-${index}`}
                      accessibilityRole="button"
                      onPress={() => closeAppAlert(button)}
                      style={({ pressed }) => [
                        styles.alertButton,
                        isDestructive && styles.alertButtonDanger,
                        isCancel && styles.alertButtonCancel,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.alertButtonText,
                          isCancel && styles.alertButtonTextCancel,
                          isDestructive && styles.alertButtonTextDanger,
                        ]}
                      >
                        {button.text ?? "OK"}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>
        </View>
      </Modal>
      {current ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingHorizontal: 16,
            },
          ]}
        >
          <View
            accessibilityRole="alert"
            style={[
              styles.toast,
              {
                borderColor: selected.borderColor,
                backgroundColor: selected.backgroundColor,
              },
            ]}
          >
            <AppIcon
              name={selected.icon}
              size={20}
              color={selected.iconColor}
            />
            <View style={styles.copy}>
              <Text style={styles.title}>{current.title}</Text>
              {current.message ? (
                <Text style={styles.message}>{current.message}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              onPress={hideFeedback}
              style={styles.closeButton}
            >
              <AppIcon name="x" size={16} color={colors.navy[500]} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </AppFeedbackContext.Provider>
  );
}

function inferTone(title: string): AppFeedbackTone {
  const value = title.toLowerCase();

  if (value.includes("failed") || value.includes("error") || value.includes("denied")) {
    return "error";
  }
  if (value.includes("required") || value.includes("unavailable") || value.includes("warning")) {
    return "warning";
  }
  if (
    value.includes("success") ||
    value.includes("assigned") ||
    value.includes("updated") ||
    value.includes("sent") ||
    value.includes("created")
  ) {
    return "success";
  }

  return "info";
}

function splitAlertText(text: string) {
  const doubleLineBreak = text.split(/\n\s*\n/);

  if (doubleLineBreak.length > 1) {
    return [
      doubleLineBreak[0].trim(),
      doubleLineBreak.slice(1).join("\n\n").trim(),
    ] as const;
  }

  const [title, ...bodyParts] = text.split("\n");

  return [title.trim(), bodyParts.join("\n").trim()] as const;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.72,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxShadow: shadows.elevated,
    elevation: 4,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.navy[800],
    fontSize: 13.5,
    fontWeight: "700",
  },
  message: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  confirmBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15, 30, 51, 0.48)",
  },
  confirmPanel: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.surface,
    boxShadow: shadows.modal,
    elevation: 8,
  },
  confirmIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.royal[50],
  },
  confirmIconDanger: {
    backgroundColor: "#FFF2F1",
  },
  confirmTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },
  confirmMessage: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  confirmActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  confirmAction: {
    flex: 1,
  },
  alertActions: {
    marginTop: 18,
    gap: 9,
  },
  alertButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.royal[200],
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },
  alertButtonCancel: {
    backgroundColor: colors.surface,
  },
  alertButtonDanger: {
    borderColor: "#F4C7C3",
    backgroundColor: "#FFF2F1",
  },
  alertButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },
  alertButtonTextCancel: {
    color: colors.navy[700],
  },
  alertButtonTextDanger: {
    color: colors.errorStrong,
  },
});
