import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader, AppTextInput, Field, Notice, PrimaryButton } from "../../components/common";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { getReporterCaseDetail } from "../cases/getReporterCaseDetail";
import EvidenceUploadPanel from "./EvidenceUploadPanel";
import { pickEvidenceFile } from "./pickEvidence";
import { EvidenceCategory, EvidenceUploadStatus, PendingEvidenceFile } from "./types";
import { uploadEvidenceToCase } from "./uploadEvidence";

export default function EvidenceUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ caseId?: string | string[] }>();
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;

  const [caseReference, setCaseReference] = useState("");
  const [loadingCase, setLoadingCase] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pickError, setPickError] = useState("");
  const [picking, setPicking] = useState(false);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<PendingEvidenceFile[]>([]);
  const [statuses, setStatuses] = useState<Record<string, EvidenceUploadStatus>>(
    {}
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCase() {
      if (!caseId) {
        setPageError("Case ID is missing.");
        setLoadingCase(false);
        return;
      }

      const result = await getReporterCaseDetail(caseId);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          await logoutReporter().catch(() => undefined);
          router.replace("/login");
          return;
        }

        setPageError(result.message);
        setLoadingCase(false);
        return;
      }

      setCaseReference(result.detail.caseReference);
      setLoadingCase(false);
    }

    void loadCase();

    return () => {
      cancelled = true;
    };
  }, [caseId, router]);

  const goBack = () => {
    if (caseId) {
      router.replace(`/reporter/cases/${caseId}` as Href);
      return;
    }

    router.replace("/reporter/cases" as Href);
  };

  const handlePick = async (category: EvidenceCategory) => {
    if (!caseId || picking) {
      return;
    }

    try {
      setPicking(true);
      setPickError("");
      const result = await pickEvidenceFile(category);

      if (!result.ok) {
        if (result.reason === "invalid") {
          setPickError(result.message);
        }
        return;
      }

      const next = {
        ...result.file,
        description: description.trim(),
      };
      setFiles((current) => [next, ...current]);
      setDescription("");
      setStatuses((current) => ({
        ...current,
        [next.localId]: { progress: 10, phase: "uploading" },
      }));

      const uploaded = await uploadEvidenceToCase(caseId, next, (progress) => {
        setStatuses((current) => ({
          ...current,
          [next.localId]: { progress, phase: "uploading" },
        }));
      });

      if (!uploaded.ok) {
        if (uploaded.reason === "unauthenticated") {
          await logoutReporter().catch(() => undefined);
          router.replace("/login");
          return;
        }

        setStatuses((current) => ({
          ...current,
          [next.localId]: {
            progress: 0,
            phase: "error",
            error: uploaded.message,
          },
        }));
        return;
      }

      setStatuses((current) => ({
        ...current,
        [next.localId]: { progress: 100, phase: "uploaded" },
      }));
    } finally {
      setPicking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader
        title="Upload evidence"
        subtitle={caseReference || "Supporting files"}
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Photos, videos, voice recordings or documents all help. Each file is
          stored securely and set to pending review for this case only.
        </Text>

        <View style={styles.field}>
          <Field
            label="Evidence description"
            optional
            hint="This note is saved with the next file you add."
          >
            <AppTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What does this file show?"
            />
          </Field>
        </View>

        {loadingCase ? (
          <Notice tone="info">Loading this case…</Notice>
        ) : null}

        {pageError ? (
          <Notice tone="error" title="Unable to upload">
            {pageError}
          </Notice>
        ) : (
          <EvidenceUploadPanel
            files={files}
            statuses={statuses}
            error={pickError}
            picking={picking || loadingCase}
            onPick={(category) => void handlePick(category)}
            onRemove={(localId) => {
              setFiles((current) =>
                current.filter((file) => file.localId !== localId)
              );
              setStatuses((current) => {
                const next = { ...current };
                delete next[localId];
                return next;
              });
            }}
            onDescriptionChange={(localId, nextDescription) => {
              setFiles((current) =>
                current.map((file) =>
                  file.localId === localId
                    ? { ...file, description: nextDescription }
                    : file
                )
              );
            }}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Done" onPress={goBack} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  intro: {
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  field: {
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
