import { useState } from "react";
import { useRouter } from "expo-router";

import EvidenceUploadPanel from "../evidence/EvidenceUploadPanel";
import { pickEvidenceFile } from "../evidence/pickEvidence";
import { EvidenceCategory } from "../evidence/types";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";

export default function StepEvidenceScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const goNext = () => router.push("/reporter/report/privacy");

  const handlePick = async (category: EvidenceCategory) => {
    try {
      setPicking(true);
      setError("");
      const result = await pickEvidenceFile(category);

      if (!result.ok) {
        if (result.reason === "invalid") {
          setError(result.message);
        }
        return;
      }

      updateDraft({
        pendingEvidence: [result.file, ...draft.pendingEvidence],
      });
    } finally {
      setPicking(false);
    }
  };

  return (
    <ReportStepLayout
      step={7}
      title="Add anything that supports your report"
      intro="Photos, videos, voice recordings or documents all help. If you have nothing to add, that is completely fine."
      skipLabel="Skip — I have no files to add"
      onSkip={goNext}
      onContinue={goNext}
      error={error}
    >
      <EvidenceUploadPanel
        files={draft.pendingEvidence}
        picking={picking}
        onPick={(category) => void handlePick(category)}
        onRemove={(localId) => {
          updateDraft({
            pendingEvidence: draft.pendingEvidence.filter(
              (file) => file.localId !== localId
            ),
          });
        }}
        onDescriptionChange={(localId, description) => {
          updateDraft({
            pendingEvidence: draft.pendingEvidence.map((file) =>
              file.localId === localId ? { ...file, description } : file
            ),
          });
        }}
      />
    </ReportStepLayout>
  );
}
