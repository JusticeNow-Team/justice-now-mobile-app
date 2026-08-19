import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  AppTextInput,
  AuthScreen,
  CheckboxRow,
  DataRow,
  Field,
  Notice,
  PrimaryButton,
  SectionCard,
  SelectInput,
} from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import {
  reporterLanguages,
  ReporterLanguageCode,
} from "../registration/languages";
import { getReporterProfile } from "./getReporterProfile";
import { ReporterProfile } from "./types";
import { updateReporterProfile } from "./updateReporterProfile";
import {
  hasProfileErrors,
  ProfileErrors,
  validateReporterProfile,
} from "./validation";

export default function PersonalInformationScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ReporterProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<ReporterLanguageCode>("en");
  const [allowContact, setAllowContact] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const applyProfile = (next: ReporterProfile) => {
    setProfile(next);
    setFullName(next.fullName);
    setPhone(next.phone);
    setLanguage(next.preferredLanguage);
    setAllowContact(next.allowCaseContact);
  };

  const loadProfile = useCallback(async () => {
    const result = await getReporterProfile();

    if (!result.ok) {
      if (result.reason === "unauthenticated" || result.reason === "forbidden") {
        await logoutReporter().catch(() => undefined);
        router.replace("/login");
        return;
      }

      setFormError(result.message);
      setLoading(false);
      return;
    }

    applyProfile(result.profile);
    setLoading(false);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setEditing(false);
      setErrors({});
      setFormError("");
      setSuccessMessage("");
      void loadProfile();
    }, [loadProfile])
  );

  const languageLabel =
    reporterLanguages.find((item) => item.code === (profile?.preferredLanguage ?? language))
      ?.label ?? "English (English)";

  const handleSave = async () => {
    if (!profile || saving) {
      return;
    }

    setFormError("");
    setSuccessMessage("");

    const nextErrors = validateReporterProfile({
      fullName,
      email: profile.email,
      phone,
    });

    setErrors(nextErrors);

    if (hasProfileErrors(nextErrors)) {
      return;
    }

    try {
      setSaving(true);

      const result = await updateReporterProfile({
        fullName,
        phone,
        preferredLanguage: language,
        allowCaseContact: allowContact,
      });

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      applyProfile({
        ...profile,
        fullName: fullName.trim(),
        phone: phone.trim(),
        preferredLanguage: language,
        allowCaseContact: allowContact,
      });
      setEditing(false);
      setSuccessMessage("Your personal information has been updated.");
    } catch {
      setFormError(
        "We could not save your profile. Please check your internet connection and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AuthScreen
        title="Personal information"
        onBack={() => router.back()}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.royal[700]} />
          <Text style={styles.loadingText}>Loading your details...</Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Personal information"
      onBack={() => router.back()}
      footer={
        editing ? (
          <PrimaryButton
            title="Save changes"
            onPress={handleSave}
            loading={saving}
          />
        ) : undefined
      }
    >
      {formError ? (
        <View style={styles.noticeWrap}>
          <Notice tone="error" title="Unable to update profile">
            {formError}
          </Notice>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.noticeWrap}>
          <Notice tone="success" title="Profile updated">
            {successMessage}
          </Notice>
        </View>
      ) : null}

      {!editing && profile ? (
        <SectionCard title="Personal information">
          <DataRow label="Full name" value={profile.fullName || "—"} />
          <DataRow label="Email" value={profile.email || "—"} />
          <DataRow label="Mobile" value={profile.phone || "—"} />
          <DataRow label="Preferred language" value={languageLabel} last />
          <View style={styles.editButton}>
            <PrimaryButton
              title="Edit personal information"
              variant="outline"
              onPress={() => {
                setSuccessMessage("");
                setFormError("");
                setEditing(true);
              }}
            />
          </View>
        </SectionCard>
      ) : null}

      {editing && profile ? (
        <View style={styles.formCard}>
          <Field
            label="Full name"
            hint="Used only inside JusticeNow, never shown publicly."
            error={errors.fullName}
          >
            <AppTextInput
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                setErrors((current) => ({ ...current, fullName: undefined }));
              }}
              placeholder="e.g. A. Perera"
              autoCapitalize="words"
              invalid={Boolean(errors.fullName)}
              accessibilityLabel="Full name"
            />
          </Field>

          <Field
            label="Email address"
            hint="Your sign-in email cannot be changed here."
            error={errors.email}
          >
            <AppTextInput
              value={profile.email}
              editable={false}
              selectTextOnFocus={false}
              style={styles.readOnlyInput}
              accessibilityLabel="Email address"
            />
          </Field>

          <Field
            label="Mobile number"
            hint="Used if a case officer needs to contact you."
            error={errors.phone}
          >
            <AppTextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setErrors((current) => ({ ...current, phone: undefined }));
              }}
              placeholder="+94 7X XXX XXXX"
              keyboardType="phone-pad"
              invalid={Boolean(errors.phone)}
              accessibilityLabel="Mobile number"
            />
          </Field>

          <Field label="Preferred language">
            <SelectInput
              value={language}
              options={reporterLanguages.map((item) => ({
                value: item.code,
                label: item.label,
              }))}
              onChange={(value) => setLanguage(value as ReporterLanguageCode)}
              accessibilityLabel="Preferred language"
            />
          </Field>

          <View style={styles.lastField}>
            <Field label="Account type">
              <AppTextInput
                value="Reporter"
                editable={false}
                selectTextOnFocus={false}
                style={styles.readOnlyInput}
                accessibilityLabel="Account type"
              />
            </Field>
          </View>

          <CheckboxRow
            checked={allowContact}
            onPress={() => setAllowContact((current) => !current)}
            label="A case officer may contact me about my reports"
            hint="You can change this for each report you submit."
          />

          <View style={styles.cancelWrap}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => {
                if (profile) {
                  applyProfile(profile);
                }
                setEditing(false);
                setErrors({});
                setFormError("");
              }}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.privacyWrap}>
        <Notice tone="privacy" title="Your details stay private">
          Name and contact information are used only inside JusticeNow. They are
          never shown publicly on a case.
        </Notice>
      </View>
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
  editButton: {
    marginTop: 12,
  },
  formCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  lastField: {
    marginBottom: 4,
  },
  readOnlyInput: {
    backgroundColor: colors.navy[50],
    color: colors.textSecondary,
  },
  cancelWrap: {
    marginTop: 8,
  },
  privacyWrap: {
    marginTop: 14,
  },
});
