import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  AppTextInput,
  AuthScreen,
  Field,
  Notice,
  PrimaryButton,
} from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { getReporterProfile } from "../profile/getReporterProfile";
import { changeReporterPassword } from "./changeReporterPassword";
import PasswordRules from "./PasswordRules";
import {
  ChangePasswordErrors,
  getPasswordRules,
  hasChangePasswordErrors,
  validateChangePassword,
} from "./validation";

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const guard = async () => {
        const result = await getReporterProfile();

        if (!active) {
          return;
        }

        if (!result.ok) {
          if (
            result.reason === "unauthenticated" ||
            result.reason === "forbidden"
          ) {
            await logoutReporter().catch(() => undefined);
            router.replace("/login");
            return;
          }
        }

        setReady(true);
      };

      void guard();

      return () => {
        active = false;
      };
    }, [router])
  );

  const rules = getPasswordRules(newPassword, currentPassword);

  const handleSave = async () => {
    setFormError("");
    setSuccessMessage("");

    const nextErrors = validateChangePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    setErrors(nextErrors);

    if (hasChangePasswordErrors(nextErrors) || saving) {
      return;
    }

    try {
      setSaving(true);

      const result = await changeReporterPassword(
        currentPassword,
        newPassword
      );

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          await logoutReporter().catch(() => undefined);
          router.replace("/login");
          return;
        }

        if (result.reason === "invalid_current") {
          setErrors((current) => ({
            ...current,
            currentPassword: result.message,
          }));
        }

        setFormError(result.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
      setSuccessMessage(
        "Your password has been updated. Other devices have been signed out."
      );
    } catch {
      setFormError(
        "We could not change your password. Please check your internet connection and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <AuthScreen
        title="Change password"
        onBack={() => router.back()}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.royal[700]} />
          <Text style={styles.loadingText}>Checking your session...</Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Change password"
      onBack={() => router.back()}
      footer={
        <PrimaryButton
          title="Save new password"
          onPress={handleSave}
          loading={saving}
        />
      }
    >
      {formError ? (
        <View style={styles.noticeWrap}>
          <Notice tone="error" title="Unable to change password">
            {formError}
          </Notice>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.noticeWrap}>
          <Notice tone="success" title="Password updated">
            {successMessage}
          </Notice>
        </View>
      ) : null}

      <View style={styles.card}>
        <Field
          label="Current password"
          hint="Enter your current password to confirm it's you."
          error={errors.currentPassword}
        >
          <AppTextInput
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              setErrors((current) => ({
                ...current,
                currentPassword: undefined,
              }));
            }}
            placeholder="Enter your current password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            invalid={Boolean(errors.currentPassword)}
            accessibilityLabel="Current password"
          />
        </Field>

        <Field label="New password" error={errors.newPassword}>
          <AppTextInput
            value={newPassword}
            onChangeText={(value) => {
              setNewPassword(value);
              setErrors((current) => ({ ...current, newPassword: undefined }));
            }}
            placeholder="Enter a new password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            invalid={Boolean(errors.newPassword)}
            accessibilityLabel="New password"
          />
        </Field>

        <Field
          label="Confirm new password"
          error={errors.confirmPassword}
        >
          <AppTextInput
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setErrors((current) => ({
                ...current,
                confirmPassword: undefined,
              }));
            }}
            placeholder="Re-enter the new password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            invalid={Boolean(errors.confirmPassword)}
            accessibilityLabel="Confirm new password"
          />
        </Field>

        <PasswordRules rules={rules} />
      </View>

      <Text style={styles.footnote}>
        After saving, you will be signed out of all other devices. Any open
        drafts remain saved on your account.
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  noticeWrap: {
    marginBottom: 14,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  footnote: {
    marginTop: 16,
    paddingHorizontal: 4,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
