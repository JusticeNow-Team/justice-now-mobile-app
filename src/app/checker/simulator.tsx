import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  formatBytes,
  MAX_EVIDENCE_BYTES,
  validateEvidenceMetadata,
} from "../../checker/metadataValidation";
import { EvidenceRecord, EvidenceValidationStatus } from "../../checker/types";
import { colors } from "../../theme";

const PRESET_SCENARIOS: { name: string; icon: string; payload: Partial<EvidenceRecord> }[] = [
  {
    name: "1. Valid Photo Evidence",
    icon: "✅",
    payload: {
      id: "EVD-2026-9901",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "scene_photo_evidence.png",
      fileType: "image/png",
      evidenceType: "image",
      fileSizeBytes: 3500000, // 3.5 MB
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "2. Unsupported File Type (.exe)",
    icon: "🚫",
    payload: {
      id: "EVD-2026-9902",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "unsupported_binary_payload.exe",
      fileType: "application/x-msdownload",
      evidenceType: "document",
      fileSizeBytes: 12000000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "3. Oversized File (>100 MB)",
    icon: "🐘",
    payload: {
      id: "EVD-2026-9903",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "large_raw_video_footage.mp4",
      fileType: "video/mp4",
      evidenceType: "video",
      fileSizeBytes: 150000000, // 150 MB!
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "4. Unlinked Case & Reporter",
    icon: "🔗",
    payload: {
      id: "EVD-2026-9904",
      caseId: "", // Missing Case Link
      reporterId: "", // Missing Reporter Link
      fileName: "orphan_report.pdf",
      fileType: "application/pdf",
      evidenceType: "document",
      fileSizeBytes: 1024000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
    },
  },
  {
    name: "5. Corrupted 0-Byte File",
    icon: "⚠️",
    payload: {
      id: "EVD-2026-9905",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "empty_audio_clip.m4a",
      fileType: "audio/m4a",
      evidenceType: "audio",
      fileSizeBytes: 0, // 0 Bytes
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "6. Exposed Local Device Path",
    icon: "💻",
    payload: {
      id: "EVD-2026-9906",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "file:///C:/Users/kavin/Documents/confidential.jpg", // Local Path Leak!
      fileType: "image/jpeg",
      evidenceType: "image",
      fileSizeBytes: 2400000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      localPathExposed: true,
      storagePath: "file:///C:/Users/kavin/Documents/confidential.jpg",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "7. Public Path Storage Exposure",
    icon: "🔓",
    payload: {
      id: "EVD-2026-9907",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "unprotected_photo.jpg",
      fileType: "image/jpeg",
      evidenceType: "image",
      fileSizeBytes: 1800000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      isPrivateBucket: false,
      storageBucket: "public-bucket",
      storagePath: "public/unprotected_photo.jpg",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "8. Missing File in Storage Vault (404)",
    icon: "❓",
    payload: {
      id: "EVD-2026-9908",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "missing_asset.pdf",
      fileType: "application/pdf",
      evidenceType: "document",
      fileSizeBytes: 950000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      fileExistsInStorage: false, // 404 Storage Error
      storagePath: "cases/CASE-2026-0812/evidence/EVD-2026-9908_missing_asset.pdf",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "9. Private Storage Vault & Collision-Proof Slug",
    icon: "🔒",
    payload: {
      id: "EVD-2026-9909",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "collision_proof_audio.m4a",
      fileType: "audio/m4a",
      evidenceType: "audio",
      fileSizeBytes: 5200000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      isPrivateBucket: true,
      storageBucket: "case-evidence",
      storagePath: "cases/CASE-2026-0812/evidence/EVD-2026-9909_1771660000_collision_proof_audio.m4a",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "10. Exceeded Signed Token Expiry (>1 Hour)",
    icon: "⏰",
    payload: {
      id: "EVD-2026-9910",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "excessive_token_duration.pdf",
      fileType: "application/pdf",
      evidenceType: "document",
      fileSizeBytes: 1800000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      signedUrlExpirySeconds: 7200, // 2 Hours (Security Warning!)
      storagePath: "cases/CASE-2026-0812/evidence/EVD-2026-9910_excessive_token.pdf",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "9. Transition: Pending ➔ Under Review",
    icon: "🔎",
    payload: {
      id: "EVD-2026-9909",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "examination_in_progress.jpg",
      fileType: "image/jpeg",
      evidenceType: "image",
      fileSizeBytes: 2100000,
      uploadDate: new Date().toISOString(),
      validationStatus: "under_review",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
  {
    name: "10. Invalid Direct Transition (Pending ➔ Archived)",
    icon: "🚫",
    payload: {
      id: "EVD-2026-9910",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "direct_archived_attempt.pdf",
      fileType: "application/pdf",
      evidenceType: "document",
      fileSizeBytes: 1200000,
      uploadDate: new Date().toISOString(),
      validationStatus: "archived",
      caseInfo: { id: "CASE-2026-0812", caseReference: "JN-2026-0812", title: "Detention Case" },
      reporterInfo: { id: "REP-4402", fullName: "Elena Rostova" },
    },
  },
];

export default function EvidenceMetadataSimulatorScreen() {
  const router = useRouter();

  const [form, setForm] = useState<Partial<EvidenceRecord>>({
    id: "EVD-SIM-001",
    caseId: "CASE-2026-100",
    reporterId: "REP-500",
    fileName: "sample_evidence.jpg",
    fileType: "image/jpeg",
    fileSizeBytes: 2048000, // 2 MB
    uploadDate: new Date().toISOString(),
    validationStatus: "pending",
  });

  const validation = useMemo(() => validateEvidenceMetadata(form), [form]);

  const loadPreset = (payload: Partial<EvidenceRecord>) => {
    setForm({ ...payload });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/checker");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy[900]} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </Pressable>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Metadata Rules Simulator</Text>
            <Text style={styles.headerSub}>Test Acceptance Criteria Compliance</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Preset Selector */}
        <View style={styles.presetSection}>
          <Text style={styles.sectionTitle}>⚡ Quick Preset Test Cases</Text>
          <Text style={styles.sectionSub}>Select a preset payload to evaluate criteria:</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
            {PRESET_SCENARIOS.map((preset, idx) => (
              <Pressable
                key={idx}
                style={styles.presetChip}
                onPress={() => loadPreset(preset.payload)}
              >
                <Text style={styles.presetIcon}>{preset.icon}</Text>
                <Text style={styles.presetChipText}>{preset.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Live Criteria Evaluation Result Card */}
        <View
          style={[
            styles.resultCard,
            validation.isValid ? styles.resultValid : styles.resultInvalid,
          ]}
        >
          <View style={styles.resultHeader}>
            <Text style={styles.resultIcon}>{validation.isValid ? "✅" : "❌"}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.resultTitle,
                  validation.isValid ? styles.resultTitleValid : styles.resultTitleInvalid,
                ]}
              >
                {validation.isValid ? "ACCEPTANCE CRITERIA PASSED" : "ACCEPTANCE CRITERIA FAILED"}
              </Text>

              <Text style={styles.resultSub}>
                {validation.isValid
                  ? "This evidence record contains valid metadata."
                  : `${validation.errors.length} Criteria violation(s) detected.`}
              </Text>
            </View>
          </View>

          {validation.errors.length > 0 && (
            <View style={styles.errorContainer}>
              {validation.errors.map((err, i) => (
                <Text key={i} style={styles.errorText}>
                  • {err}
                </Text>
              ))}
            </View>
          )}

          {validation.warnings.length > 0 && (
            <View style={styles.warningContainer}>
              {validation.warnings.map((warn, i) => (
                <Text key={i} style={styles.warningText}>
                  • {warn}
                </Text>
              ))}
            </View>
          )}

          {/* Audit breakdown checklist */}
          <View style={styles.auditChecklist}>
            <AuditItem label="1. Unique ID Present" ok={validation.audit.hasUniqueId} />
            <AuditItem label="2. Linked to Case" ok={validation.audit.hasCaseLink} />
            <AuditItem label="2. Linked to Reporter" ok={validation.audit.hasReporterLink} />
            <AuditItem label="3. File Attributes Recorded" ok={validation.audit.hasRecordedAttributes} />
            <AuditItem label="4 & 6. Allowed File Type (JPG, PNG, MP4, M4A, PDF)" ok={validation.audit.isAllowedFileType} />
            <AuditItem label="5. Max File Size (<= 100 MB)" ok={validation.audit.isWithinMaxFileSize} />
            <AuditItem label="7. Non-Empty / Valid Metadata" ok={validation.audit.isMetadataValid} />
            <AuditItem label="8. Default Pending Status" ok={validation.audit.isDefaultPendingStatus} />

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />

            <AuditItem label="SEC-1. Stored Outside Public Access" ok={validation.audit.isStoredInPrivatePath} />
            <AuditItem label="SEC-2. Linked to Correct Case Path" ok={validation.audit.isLinkedToCorrectCasePath} />
            <AuditItem label="SEC-3. Collision-Proof File Name" ok={validation.audit.hasCollisionProofFileName} />
            <AuditItem label="SEC-4. Protected Access (15-Min Token)" ok={validation.audit.isProtectedFromUnauthorizedAccess} />
            <AuditItem label="SEC-5. Missing File Errors Handled" ok={validation.audit.handlesMissingFileErrors} />
            <AuditItem label="SEC-6. Transactional Upload Integrity" ok={validation.audit.preventsIncompleteUploadRecords} />
            <AuditItem label="SEC-7. Local Server Paths Protected" ok={validation.audit.doesNotExposeLocalServerPaths} />

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />

            <AuditItem label="PRV-1. Safe Preview Supported for Images/Docs" ok={validation.audit.isSupportedPreview} />
            <AuditItem label="PRV-2. Controlled Download Workflow for Unsupported Files" ok={validation.audit.offersControlledDownloadForUnsupported || validation.audit.isSupportedPreview} />
            <AuditItem label="PRV-3. Public URLs Do Not Expose Evidence" ok={validation.audit.preventsPublicUrlExposure} />
          </View>

        </View>

        {/* Payload Form Editor */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>✏️ Custom Metadata Form</Text>
          <Text style={styles.sectionSub}>Edit fields below to test validation rules:</Text>

          <View style={styles.formGrid}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Evidence ID (Criteria #1):</Text>
              <TextInput
                style={styles.input}
                value={form.id || ""}
                onChangeText={(val) => setForm((prev) => ({ ...prev, id: val }))}
                placeholder="EVD-XXXX"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Case ID Link (Criteria #2):</Text>
              <TextInput
                style={styles.input}
                value={form.caseId || ""}
                onChangeText={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    caseId: val,
                    caseInfo: val ? { id: val, caseReference: `JN-${val}`, title: "Test Case" } : undefined,
                  }))
                }
                placeholder="CASE-XXXX"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Reporter ID Link (Criteria #2):</Text>
              <TextInput
                style={styles.input}
                value={form.reporterId || ""}
                onChangeText={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    reporterId: val,
                    reporterInfo: val ? { id: val, fullName: `Reporter ${val}` } : undefined,
                  }))
                }
                placeholder="REP-XXXX"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>File Name (Criteria #3, #4):</Text>
              <TextInput
                style={styles.input}
                value={form.fileName || ""}
                onChangeText={(val) => setForm((prev) => ({ ...prev, fileName: val }))}
                placeholder="photo.jpg / document.pdf / installer.exe"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>MIME File Type (Criteria #3, #4):</Text>
              <TextInput
                style={styles.input}
                value={form.fileType || ""}
                onChangeText={(val) => setForm((prev) => ({ ...prev, fileType: val }))}
                placeholder="image/jpeg, application/pdf"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                File Size in Bytes (Criteria #5 {"<= 100 MB"} = {MAX_EVIDENCE_BYTES} B):
              </Text>
              <TextInput
                style={styles.input}
                value={String(form.fileSizeBytes ?? 0)}
                onChangeText={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    fileSizeBytes: parseInt(val, 10) || 0,
                  }))
                }
                keyboardType="numeric"
              />
              <Text style={styles.sizeHint}>
                Formatted: {formatBytes(form.fileSizeBytes || 0)}
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Status (Criteria #8 Default: pending):</Text>
              <View style={styles.statusChipRow}>
                {(["pending", "validated", "rejected", "info_requested"] as EvidenceValidationStatus[]).map(
                  (st) => (
                    <Pressable
                      key={st}
                      style={[
                        styles.statusChip,
                        form.validationStatus === st && styles.statusChipActive,
                      ]}
                      onPress={() => setForm((prev) => ({ ...prev, validationStatus: st }))}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          form.validationStatus === st && styles.statusChipTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuditItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.auditRow}>
      <Text style={[styles.auditIcon, { color: ok ? "#047857" : "#B91C1C" }]}>
        {ok ? "✓" : "❌"}
      </Text>
      <Text style={[styles.auditText, { color: ok ? "#065F46" : "#991B1B" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  header: {
    backgroundColor: colors.navy[900],
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  headerInner: {
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },

  backBtnText: {
    color: colors.teal[300],
    fontSize: 15,
    fontWeight: "700",
  },

  headerTitleBox: {
    alignItems: "center",
  },

  headerTitle: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "800",
  },

  headerSub: {
    color: colors.navy[200],
    fontSize: 11,
  },

  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },

  // Presets
  presetSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy[900],
  },

  sectionSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },

  presetRow: {
    flexDirection: "row",
  },

  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.royal[50],
    borderWidth: 1,
    borderColor: colors.royal[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },

  presetIcon: {
    fontSize: 12,
    marginRight: 6,
  },

  presetChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.royal[700],
  },

  // Result card
  resultCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },

  resultValid: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },

  resultInvalid: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  resultIcon: {
    fontSize: 26,
    marginRight: 10,
  },

  resultTitle: {
    fontSize: 14,
    fontWeight: "800",
  },

  resultTitleValid: {
    color: "#047857",
  },

  resultTitleInvalid: {
    color: "#B91C1C",
  },

  resultSub: {
    fontSize: 11.5,
    color: colors.navy[800],
    marginTop: 2,
  },

  errorContainer: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    marginBottom: 10,
  },

  errorText: {
    fontSize: 11.5,
    color: colors.error,
    fontWeight: "600",
    marginVertical: 1,
  },

  warningContainer: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
    marginBottom: 10,
  },

  warningText: {
    fontSize: 11.5,
    color: "#D97706",
    fontWeight: "600",
    marginVertical: 1,
  },

  auditChecklist: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    padding: 10,
    borderRadius: 8,
  },

  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3,
  },

  auditIcon: {
    fontSize: 12,
    fontWeight: "800",
    marginRight: 6,
    width: 16,
  },

  auditText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Form card
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  formGrid: {
    marginTop: 6,
  },

  fieldGroup: {
    marginBottom: 12,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 4,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.navy[900],
    backgroundColor: colors.surface,
  },

  sizeHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  statusChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },

  statusChipActive: {
    backgroundColor: colors.royal[700],
  },

  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[700],
  },

  statusChipTextActive: {
    color: colors.surface,
  },
});
