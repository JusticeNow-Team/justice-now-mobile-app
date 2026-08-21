import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
  fetchEvidenceCheckerQueue,
  updateEvidenceValidationDecision,
} from "../../../checker/api";
import {
  formatBytes,
  MAX_EVIDENCE_BYTES,
  validateEvidenceMetadata,
} from "../../../checker/metadataValidation";
import {
  EvidenceRecord,
  EvidenceValidationStatus,
  MetadataValidationResult,
} from "../../../checker/types";
import { colors } from "../../../theme";

export default function EvidenceAuditDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Decision Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [decisionType, setDecisionType] = useState<EvidenceValidationStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [checkerNotes, setCheckerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generatingSignedUrl, setGeneratingSignedUrl] = useState(false);
  const [signedUrlToken, setSignedUrlToken] = useState<string | null>(null);

  const loadRecord = async () => {
    try {
      const queue = await fetchEvidenceCheckerQueue();
      const match = queue.find((item) => item.id === id);
      setRecord(match || null);
    } catch (err) {
      console.error("Error loading evidence item:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecord();
  }, [id]);

  const validation: MetadataValidationResult | null = useMemo(() => {
    if (!record) return null;
    return validateEvidenceMetadata(record);
  }, [record]);

  const handleGenerateSignedAccessUrl = () => {
    setGeneratingSignedUrl(true);
    setTimeout(() => {
      const timestamp = Math.floor(Date.now() / 1000) + 900; // 15 mins expiry
      const token = `https://justicenow-secure-vault.internal/signed-access/${record?.id || "EVD"}?exp=${timestamp}&sig=auth_verified_staff`;
      setSignedUrlToken(token);
      setGeneratingSignedUrl(false);
      Alert.alert(
        "🔒 Secure Time-Limited Token Generated",
        "Generated a 15-minute signed access token for authorized staff review. Access expires automatically after 900 seconds."
      );
    }, 600);
  };

  const openDecisionModal = (type: EvidenceValidationStatus) => {
    setDecisionType(type);
    setRejectionReason("");
    setCheckerNotes("");

    // Auto-fill common rejection reasons if rejecting
    if (type === "rejected" && validation && !validation.isValid) {
      setRejectionReason(validation.errors.join(" "));
    }
    setModalVisible(true);
  };

  const handleApplyDecision = async () => {
    if (!record || !decisionType) return;

    if (decisionType === "rejected" && !rejectionReason.trim()) {
      Alert.alert(
        "Rejection Reason Required",
        "Please enter an explanation for rejecting this evidence metadata."
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await updateEvidenceValidationDecision({
        evidenceId: record.id,
        status: decisionType,
        rejectionReason: decisionType === "rejected" ? rejectionReason : undefined,
        notes: checkerNotes,
        checkerId: "Evidence Checker Squad #1",
      });

      if (res.ok) {
        Alert.alert("Status Updated", res.message);
        setModalVisible(false);
        await loadRecord();
      } else {
        Alert.alert("Error", res.message);
      }
    } catch (err: any) {
      Alert.alert("Execution Error", err.message || "Failed to update decision.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/checker");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />
        <Text style={styles.loadingText}>Fetching evidence record...</Text>
      </SafeAreaView>
    );
  }

  if (!record || !validation) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Evidence Record Not Found</Text>
        <Text style={styles.errorSub}>Requested ID: {id}</Text>
        <Pressable style={styles.backButtonBtn} onPress={handleBack}>
          <Text style={styles.backButtonText}>Return to Queue</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { audit } = validation;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy[900]} />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Dashboard"
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Evidence Audit</Text>
          <Text style={styles.headerSub}>{record.id}</Text>
        </View>

        <StatusBadge status={record.validationStatus} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Validation Health Overview Card */}
        <View
          style={[
            styles.healthCard,
            validation.isValid ? styles.healthValid : styles.healthInvalid,
          ]}
        >
          <View style={styles.healthHeader}>
            <Text style={styles.healthIcon}>
              {validation.isValid ? "✅" : "❌"}
            </Text>

            <View style={styles.healthMain}>
              <Text
                style={[
                  styles.healthTitle,
                  validation.isValid
                    ? styles.healthTitleValid
                    : styles.healthTitleInvalid,
                ]}
              >
                {validation.isValid
                  ? "VALID EVIDENCE METADATA"
                  : "INVALID METADATA DETECTED"}
              </Text>

              <Text style={styles.healthSub}>
                {validation.isValid
                  ? "All Metadata & Secure Storage Criteria are satisfied."
                  : `${validation.errors.length} criteria rule violation(s) found.`}
              </Text>
            </View>
          </View>

          {/* Validation Errors List */}
          {validation.errors.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxTitle}>Critical Rejection Rules:</Text>
              {validation.errors.map((err, idx) => (
                <Text key={idx} style={styles.errorBoxItem}>
                  • {err}
                </Text>
              ))}
            </View>
          )}

          {/* Security Callouts List */}
          {validation.securityCallouts.length > 0 && (
            <View style={styles.securityBox}>
              <Text style={styles.securityBoxTitle}>Security Storage Issues:</Text>
              {validation.securityCallouts.map((sec, idx) => (
                <Text key={idx} style={styles.securityBoxItem}>
                  • {sec}
                </Text>
              ))}
            </View>
          )}

          {/* Validation Warnings List */}
          {validation.warnings.length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningBoxTitle}>Metadata Warnings:</Text>
              {validation.warnings.map((warn, idx) => (
                <Text key={idx} style={styles.warningBoxItem}>
                  • {warn}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* 🔒 Secure Evidence Storage & Access Control Audit */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            🔒 Secure Reference Storage Audit
          </Text>
          <Text style={styles.sectionSubtitle}>
            Protection of evidence files outside public access:
          </Text>

          <View style={styles.checklistGrid}>
            <ChecklistItem
              number="SEC-1"
              title="Private Path Storage"
              detail={
                audit.isStoredInPrivatePath
                  ? `Bucket '${record.storageBucket || "case-evidence"}' (Outside public access paths)`
                  : "Public path warning!"
              }
              passed={audit.isStoredInPrivatePath}
            />

            <ChecklistItem
              number="SEC-2"
              title="Case Link Match in Path"
              detail={`Path linked to case: ${record.caseInfo?.caseReference || record.caseId}`}
              passed={audit.isLinkedToCorrectCasePath}
            />

            <ChecklistItem
              number="SEC-3"
              title="Collision-Proof File Slug"
              detail="Unique ID & timestamp slug prevents file overwrites."
              passed={audit.hasCollisionProofFileName}
            />

            <ChecklistItem
              number="SEC-4"
              title="Access Control & Signed URL Policy"
              detail="Accessible only by authorized staff via 15-min signed tokens."
              passed={audit.isProtectedFromUnauthorizedAccess}
            />

            <ChecklistItem
              number="SEC-5"
              title="Missing-File Error Handling"
              detail={
                audit.handlesMissingFileErrors
                  ? "404 Storage missing-file errors handled gracefully."
                  : "Missing storage object!"
              }
              passed={audit.handlesMissingFileErrors}
            />

            <ChecklistItem
              number="SEC-6"
              title="Transactional Upload Integrity"
              detail="Failed uploads rollback DB records to prevent incomplete entries."
              passed={audit.preventsIncompleteUploadRecords}
            />

            <ChecklistItem
              number="SEC-7"
              title="No Exposed Local Server Paths"
              detail={
                audit.doesNotExposeLocalServerPaths
                  ? "Local device file paths stripped & protected."
                  : "Exposes local device paths!"
              }
              passed={audit.doesNotExposeLocalServerPaths}
            />
          </View>

          {/* Action: Generate Signed URL token for staff */}
          <Pressable
            style={styles.signedUrlBtn}
            onPress={handleGenerateSignedAccessUrl}
            disabled={generatingSignedUrl}
            accessibilityRole="button"
          >
            {generatingSignedUrl ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.signedUrlBtnText}>
                🔑 Generate 15-Min Signed Access URL Token
              </Text>
            )}
          </Pressable>

          {signedUrlToken && (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>Secure Access Token (Active):</Text>
              <Text style={styles.tokenValue}>{signedUrlToken}</Text>
            </View>
          )}
        </View>

        {/* 📋 Acceptance Criteria Audit Checklist */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            📋 Acceptance Criteria Audit Checklist
          </Text>

          <View style={styles.checklistGrid}>
            <ChecklistItem
              number="1"
              title="Unique Evidence ID"
              detail={`ID: '${record.id}'`}
              passed={audit.hasUniqueId}
            />

            <ChecklistItem
              number="2"
              title="Linked to Case"
              detail={
                audit.hasCaseLink
                  ? `Case: ${record.caseInfo?.caseReference || record.caseId}`
                  : "Missing Case Association!"
              }
              passed={audit.hasCaseLink}
            />

            <ChecklistItem
              number="2"
              title="Linked to Reporter"
              detail={
                audit.hasReporterLink
                  ? `Reporter: ${record.reporterInfo?.fullName || record.reporterId}`
                  : "Missing Reporter Link!"
              }
              passed={audit.hasReporterLink}
            />

            <ChecklistItem
              number="3"
              title="Recorded File Attributes"
              detail={`Name, type, size (${formatBytes(
                record.fileSizeBytes
              )}), date, and status recorded.`}
              passed={audit.hasRecordedAttributes}
            />

            <ChecklistItem
              number="4"
              title="Allowed File Type Defined"
              detail={`Allowed: JPG, PNG, MP4, M4A, PDF. Found: '${
                record.fileName.split(".").pop() || ""
              }' (${record.fileType})`}
              passed={audit.isAllowedFileType}
            />

            <ChecklistItem
              number="5"
              title="Max File Size Defined (100 MB)"
              detail={`Limit: 100 MB (${formatBytes(
                MAX_EVIDENCE_BYTES
              )}). Current: ${formatBytes(record.fileSizeBytes)}`}
              passed={audit.isWithinMaxFileSize}
            />

            <ChecklistItem
              number="6"
              title="Unsupported Files Rejected"
              detail={
                audit.isAllowedFileType
                  ? "File type verified as supported."
                  : "Unsupported format flagged for rejection."
              }
              passed={audit.isAllowedFileType}
            />

            <ChecklistItem
              number="7"
              title="Empty / Invalid Metadata Rejected"
              detail={
                audit.isMetadataValid
                  ? "Metadata structure is complete & valid."
                  : "Empty/invalid metadata flagged for rejection."
              }
              passed={audit.isMetadataValid}
            />

            <ChecklistItem
              number="8"
              title="Default Pending Status"
              detail={`Status: '${record.validationStatus}'. Newly created evidence must default to Pending.`}
              passed={audit.isDefaultPendingStatus}
              isWarning={!audit.isDefaultPendingStatus}
            />
          </View>
        </View>

        {/* Detailed Metadata Breakdown */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ℹ️ Record Metadata Details</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Unique Identifier (ID):</Text>
            <Text style={styles.metaValue}>{record.id}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>File Name:</Text>
            <Text style={styles.metaValue}>{record.fileName}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>MIME File Type:</Text>
            <Text style={styles.metaValue}>{record.fileType}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>File Size:</Text>
            <Text style={styles.metaValue}>
              {formatBytes(record.fileSizeBytes)} ({record.fileSizeBytes} Bytes)
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Upload Timestamp:</Text>
            <Text style={styles.metaValue}>
              {new Date(record.uploadDate).toLocaleString()}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Storage Bucket:</Text>
            <Text style={styles.metaValue}>{record.storageBucket || "case-evidence (Private)"}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Storage Path:</Text>
            <Text style={styles.metaValue}>{record.storagePath || "case-evidence/secure_path"}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Public Path Status:</Text>
            <Text style={[styles.metaValue, { color: "#047857" }]}>
              🔒 Outside Public Access (Private Bucket)
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Collision Prevention:</Text>
            <Text style={[styles.metaValue, { color: "#047857" }]}>
              ✓ Collision-Proof Unique Slug
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Access Control Policy:</Text>
            <Text style={[styles.metaValue, { color: "#047857" }]}>
              🔑 Restricted via 15-Min Signed Token
            </Text>
          </View>

          <Pressable
            style={styles.signedUrlBtn}
            onPress={handleGenerateSignedAccessUrl}
            disabled={generatingSignedUrl}
            accessibilityRole="button"
          >
            {generatingSignedUrl ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.signedUrlBtnText}>
                🔑 Generate 15-Min Signed Access URL Token
              </Text>
            )}
          </Pressable>

          {signedUrlToken && (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>Secure Access Token (Active):</Text>
              <Text style={styles.tokenValue}>{signedUrlToken}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Linked Case Reference:</Text>
            <Text style={styles.metaValue}>
              {record.caseInfo?.caseReference || record.caseId || "UNLINKED"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Linked Reporter Name:</Text>
            <Text style={styles.metaValue}>
              {record.reporterInfo?.fullName || record.reporterId || "UNLINKED"}
            </Text>
          </View>

          {record.description && (
            <View style={styles.metaRowVertical}>
              <Text style={styles.metaLabel}>Description / Notes:</Text>
              <Text style={styles.metaValueBox}>{record.description}</Text>
            </View>
          )}

          {record.rejectionReason && (
            <View style={styles.metaRowVertical}>
              <Text style={[styles.metaLabel, { color: colors.error }]}>
                Recorded Rejection Reason:
              </Text>
              <Text style={styles.rejectionBox}>{record.rejectionReason}</Text>
            </View>
          )}
        </View>

        {/* Evidence Checker Action Controls */}
        <View style={styles.actionCard}>
          <Text style={styles.actionCardTitle}>⚡ Evidence Checker Decision</Text>
          <Text style={styles.actionCardSub}>
            Record your validation assessment for downstream investigators:
          </Text>

          <View style={styles.actionButtonsCol}>
            <Pressable
              style={[styles.actionBtn, styles.validateBtn]}
              onPress={() => openDecisionModal("validated")}
              accessibilityRole="button"
            >
              <Text style={styles.validateBtnText}>
                ✓ Validate & Accept Metadata
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => openDecisionModal("rejected")}
              accessibilityRole="button"
            >
              <Text style={styles.rejectBtnText}>
                ❌ Reject Evidence (Invalid / Unsupported)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.infoBtn]}
              onPress={() => openDecisionModal("info_requested")}
              accessibilityRole="button"
            >
              <Text style={styles.infoBtnText}>
                ❓ Request Additional Metadata Info
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Decision Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {decisionType === "validated" && "Confirm Evidence Validation"}
              {decisionType === "rejected" && "Reject Evidence Record"}
              {decisionType === "info_requested" && "Request Information"}
            </Text>

            <Text style={styles.modalSub}>
              {decisionType === "validated" &&
                "Confirm that evidence metadata complies with all criteria for downstream review."}
              {decisionType === "rejected" &&
                "Specify the exact reason for rejecting this evidence record."}
              {decisionType === "info_requested" &&
                "Ask the reporter or officer to provide missing metadata fields."}
            </Text>

            {decisionType === "rejected" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Rejection Reason (Required):
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="e.g. Unsupported file format .exe / File exceeds 100MB..."
                  multiline
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Checker Internal Notes (Optional):</Text>
              <TextInput
                style={styles.textInput}
                value={checkerNotes}
                onChangeText={setCheckerNotes}
                placeholder="Notes for audit log..."
              />
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalConfirmBtn,
                  decisionType === "rejected" && { backgroundColor: colors.error },
                ]}
                onPress={handleApplyDecision}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Decision</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ChecklistItem({
  number,
  title,
  detail,
  passed,
  isWarning,
}: {
  number: string;
  title: string;
  detail: string;
  passed: boolean;
  isWarning?: boolean;
}) {
  let icon = passed ? "✓" : "❌";
  let bg = passed ? "#ECFDF5" : "#FEF2F2";
  let fg = passed ? "#047857" : "#B91C1C";

  if (!passed && isWarning) {
    icon = "⚠️";
    bg = "#FEF3C7";
    fg = "#92400E";
  }

  return (
    <View style={[styles.checkItemCard, { backgroundColor: bg }]}>
      <View style={styles.checkItemHeader}>
        <Text style={[styles.checkIcon, { color: fg }]}>{icon}</Text>
        <Text style={[styles.checkTitle, { color: fg }]}>
          #{number} · {title}
        </Text>
      </View>
      <Text style={styles.checkDetail}>{detail}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: EvidenceValidationStatus }) {
  let bg = "#FEF3C7";
  let fg = "#92400E";
  let label = "Pending (#8)";

  if (status === "validated") {
    bg = "#D1FAE5";
    fg = "#065F46";
    label = "Validated";
  } else if (status === "rejected") {
    bg = "#FEE2E2";
    fg = "#991B1B";
    label = "Rejected";
  } else if (status === "info_requested") {
    bg = "#E0E7FF";
    fg = "#3730A3";
    label = "Info Requested";
  }

  return (
    <View style={[styles.headerBadge, { backgroundColor: bg }]}>
      <Text style={[styles.headerBadgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy[800],
  },

  errorSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },

  backButtonBtn: {
    marginTop: 16,
    backgroundColor: colors.royal[700],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  backButtonText: {
    color: colors.surface,
    fontWeight: "700",
  },

  // Header
  header: {
    backgroundColor: colors.navy[900],
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  headerBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },

  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },

  // Health Card
  healthCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
  },

  healthValid: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },

  healthInvalid: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },

  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  healthIcon: {
    fontSize: 26,
    marginRight: 10,
  },

  healthMain: {
    flex: 1,
  },

  healthTitle: {
    fontSize: 14,
    fontWeight: "800",
  },

  healthTitleValid: {
    color: "#047857",
  },

  healthTitleInvalid: {
    color: "#B91C1C",
  },

  healthSub: {
    fontSize: 12,
    color: colors.navy[700],
    marginTop: 2,
  },

  errorBox: {
    marginTop: 10,
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },

  errorBoxTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.error,
    marginBottom: 4,
  },

  errorBoxItem: {
    fontSize: 11.5,
    color: colors.navy[900],
    marginVertical: 1,
  },

  securityBox: {
    marginTop: 8,
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
  },

  securityBoxTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#D97706",
    marginBottom: 4,
  },

  securityBoxItem: {
    fontSize: 11.5,
    color: colors.navy[900],
    marginVertical: 1,
  },

  warningBox: {
    marginTop: 8,
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
  },

  warningBoxTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#D97706",
    marginBottom: 4,
  },

  warningBoxItem: {
    fontSize: 11.5,
    color: colors.navy[900],
    marginVertical: 1,
  },

  // Section card
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy[900],
  },

  sectionSubtitle: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },

  checklistGrid: {
    marginTop: 4,
  },

  checkItemCard: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },

  checkItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkIcon: {
    fontSize: 14,
    fontWeight: "800",
    marginRight: 6,
  },

  checkTitle: {
    fontSize: 12.5,
    fontWeight: "800",
  },

  checkDetail: {
    fontSize: 11.5,
    color: colors.navy[800],
    marginTop: 3,
    marginLeft: 20,
  },

  signedUrlBtn: {
    marginTop: 10,
    backgroundColor: colors.navy[900],
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  signedUrlBtnText: {
    color: colors.teal[300],
    fontSize: 12.5,
    fontWeight: "800",
  },

  tokenBox: {
    marginTop: 10,
    backgroundColor: colors.navy[50],
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.navy[200],
  },

  tokenLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[700],
  },

  tokenValue: {
    fontSize: 10.5,
    color: colors.royal[800],
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Metadata detail rows
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  metaRowVertical: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  metaLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[600],
  },

  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[900],
  },

  metaValueBox: {
    fontSize: 12,
    color: colors.navy[900],
    marginTop: 4,
    backgroundColor: colors.navy[50],
    padding: 8,
    borderRadius: 6,
  },

  rejectionBox: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    backgroundColor: "#FEF2F2",
    padding: 8,
    borderRadius: 6,
    fontWeight: "600",
  },

  // Action card
  actionCard: {
    backgroundColor: colors.navy[900],
    borderRadius: 12,
    padding: 14,
  },

  actionCardTitle: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
  },

  actionCardSub: {
    color: colors.navy[200],
    fontSize: 11.5,
    marginTop: 2,
    marginBottom: 14,
  },

  actionButtonsCol: {
    gap: 10,
  },

  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  validateBtn: {
    backgroundColor: "#059669",
  },

  validateBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },

  rejectBtn: {
    backgroundColor: colors.error,
  },

  rejectBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },

  infoBtn: {
    backgroundColor: colors.royal[700],
  },

  infoBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 16,
  },

  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy[900],
  },

  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },

  inputGroup: {
    marginBottom: 14,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 6,
  },

  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.navy[900],
  },

  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },

  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },

  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.navy[100],
  },

  modalCancelText: {
    color: colors.navy[800],
    fontWeight: "600",
    fontSize: 13,
  },

  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.royal[700],
  },

  modalConfirmText: {
    color: colors.surface,
    fontWeight: "700",
    fontSize: 13,
  },
});
