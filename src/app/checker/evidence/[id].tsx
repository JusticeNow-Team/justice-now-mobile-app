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
import { generateSecureSignedUrl } from "../../../checker/evidenceStorageService";
import {
  getPublicStatusForReporter,
  getCaseOfficerStatusView,
  validateStatusTransition,
} from "../../../checker/statusTransitionService";
import {
  EvidenceRecord,
  EvidenceStatus,
  EvidenceValidationStatus,
  MetadataValidationResult,
} from "../../../checker/types";
import { EvidenceSafePreview } from "../../../components/EvidenceSafePreview";
import { EvidenceStatusTimeline } from "../../../components/EvidenceStatusTimeline";
import { colors } from "../../../theme";

export default function EvidenceAuditDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true); // Toggle for authorization simulator testing
  const [activeViewRole, setActiveViewRole] = useState<"checker" | "case_officer" | "reporter">("checker");

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecord();
  }, [id]);

  const validation: MetadataValidationResult | null = useMemo(() => {
    if (!record) return null;
    return validateEvidenceMetadata(record);
  }, [record]);

  const handleGenerateSignedAccessUrl = async () => {
    if (!record) return;
  const handleGenerateSignedAccessUrl = () => {
    if (!isAuthorized) {
      Alert.alert(
        "🔒 Access Denied",
        "Signed token generation is restricted to authorized Evidence Checkers."
      );
      return;
    }

    setGeneratingSignedUrl(true);

    try {
      const userRole = isAuthorized ? "evidence_checker" : "unauthorized_guest";
      const path = record.storagePath || `cases/${record.caseId}/evidence/${record.id}_file`;

      const res = await generateSecureSignedUrl({
        evidenceId: record.id,
        storagePath: path,
        userRole,
        expirySeconds: 900,
      });

      setGeneratingSignedUrl(false);

      if (res.success && res.signedUrl) {
        setSignedUrlToken(res.signedUrl);
        Alert.alert(
          "🔒 Secure Signed Token Generated",
          `Access Granted for Role: ${userRole}\n\nSigned Token URL:\n${res.signedUrl}\n\nExpires At: ${res.expiresAt}`
        );
      } else {
        setSignedUrlToken("");
        Alert.alert("🔒 Access Denied", res.error || "Unauthorized request.");
      }
    } catch (err: any) {
      setGeneratingSignedUrl(false);
      Alert.alert("Error", err.message || "Failed to generate signed token.");
    }
  };

  const handleMarkUnderReview = async () => {
    if (!record) return;
    if (!isAuthorized) {
      Alert.alert(
        "🔒 Access Denied",
        "Updating evidence status requires active Evidence Checker authorization."
      );
      return;
    }

    try {
      const res = await updateEvidenceValidationDecision({
        evidenceId: record.id,
        status: "under_review",
        role: "checker",
        checkerId: "Evidence Checker Squad #1",
        notes: "Status transitioned to Under Review for active examination.",
      });

      if (res.ok) {
        Alert.alert("Status Updated", res.message);
        await loadRecord();
      } else {
        Alert.alert("Invalid State Transition", res.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update status.");
    }
  };

  const openDecisionModal = (type: EvidenceValidationStatus) => {
    if (!isAuthorized) {
      Alert.alert(
        "🔒 Access Denied",
        "Validation decisions require active Evidence Checker authorization."
      );
      return;
    }

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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header Bar (Magic Patterns Style) */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to queue"
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <View style={styles.headerInner}>
          <Pressable
            style={styles.backBtn}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
          >
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>{record.id}</Text>
            <Text style={styles.headerSub}>
              {record.caseInfo?.caseReference || record.caseId} · evidence review
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mobileContainer}>
          {/* Authorization Simulator Guard & Role View Switcher */}
          <View style={styles.authBarCard}>
            <View style={styles.authBarTop}>
              <View style={styles.authBadge}>
                <Text style={styles.authBadgeIcon}>{isAuthorized ? "🛡️" : "🔒"}</Text>
                <Text style={styles.authBadgeText}>
                  {isAuthorized ? "Role: Evidence Checker Squad #1" : "Unauthorized Mode"}
                </Text>
              </View>

              <Pressable
                style={[
                  styles.authToggleBtn,
                  !isAuthorized && { backgroundColor: colors.royal[700] },
                ]}
                onPress={() => setIsAuthorized(!isAuthorized)}
              >
                <Text style={styles.authToggleText}>
                  {isAuthorized ? "Simulate Unauthorized" : "Simulate Authorized"}
                </Text>
              </Pressable>
            </View>

            {/* Role-Based View Switcher Tabs (JN-174 & JN-176) */}
            <View style={styles.roleTabRow}>
              <Pressable
                style={[
                  styles.roleTabBtn,
                  activeViewRole === "checker" && styles.roleTabBtnActive,
                ]}
                onPress={() => setActiveViewRole("checker")}
              >
                <Text
                  style={[
                    styles.roleTabText,
                    activeViewRole === "checker" && styles.roleTabTextActive,
                  ]}
                >
                  🛡️ Checker View
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.roleTabBtn,
                  activeViewRole === "case_officer" && styles.roleTabBtnActive,
                ]}
                onPress={() => setActiveViewRole("case_officer")}
              >
                <Text
                  style={[
                    styles.roleTabText,
                    activeViewRole === "case_officer" && styles.roleTabTextActive,
                  ]}
                >
                  👮 Case Officer
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.roleTabBtn,
                  activeViewRole === "reporter" && styles.roleTabBtnActive,
                ]}
                onPress={() => setActiveViewRole("reporter")}
              >
                <Text
                  style={[
                    styles.roleTabText,
                    activeViewRole === "reporter" && styles.roleTabTextActive,
                  ]}
                >
                  👤 Reporter
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ------------------------------------------------------------- */}
          {/* VIEW MODE 1: REPORTER PUBLIC STATUS VIEW (JN-174 & JN-176)     */}
          {/* ------------------------------------------------------------- */}
          {activeViewRole === "reporter" && (
            <View style={styles.reporterViewCard}>
              <Text style={styles.reporterViewTitle}>👤 Reporter Status Portal</Text>
              <Text style={styles.reporterViewSub}>
                Sanitized public progress view for your evidence submission (Internal metadata & storage paths are protected):
              </Text>

              {(() => {
                const pubInfo = getPublicStatusForReporter(record.validationStatus);
                return (
                  <View style={styles.reporterStatusBox}>
                    <View
                      style={[
                        styles.reporterStatusBadge,
                        { backgroundColor: pubInfo.badgeBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reporterStatusBadgeText,
                          { color: pubInfo.badgeFg },
                        ]}
                      >
                        {pubInfo.publicLabel}
                      </Text>
                    </View>

                    <Text style={styles.reporterDescText}>
                      {pubInfo.publicDescription}
                    </Text>

                    {pubInfo.actionRequiredForReporter && (
                      <View style={styles.reporterActionCallout}>
                        <Text style={styles.reporterActionCalloutTitle}>
                          ⚠️ Action Required from Submitter
                        </Text>
                        <Text style={styles.reporterActionCalloutSub}>
                          The assigned evidence checker requested additional clarification regarding your submission. Please check your contact email for response instructions.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}

          {/* ------------------------------------------------------------- */}
          {/* VIEW MODE 2: CASE OFFICER TECHNICAL VIEW (JN-174)             */}
          {/* ------------------------------------------------------------- */}
          {activeViewRole === "case_officer" && (
            <View style={styles.officerCard}>
              <Text style={styles.officerTitle}>👮 Case Officer Technical Overview</Text>
              <Text style={styles.officerSub}>
                Investigator view with chain-of-custody timestamps & security audit parameters:
              </Text>

              {(() => {
                const officerView = getCaseOfficerStatusView(record);
                return (
                  <View style={styles.officerGrid}>
                    <View style={styles.officerRow}>
                      <Text style={styles.officerLabel}>Chain of Custody Status:</Text>
                      <Text
                        style={[
                          styles.officerValue,
                          {
                            color: officerView.isChainOfCustodyActive
                              ? "#059669"
                              : "#D97706",
                            fontWeight: "800",
                          },
                        ]}
                      >
                        {officerView.isChainOfCustodyActive
                          ? "✓ Verified & Active for Court Filing"
                          : "⚠️ Examination In Progress"}
                      </Text>
                    </View>

                    <View style={styles.officerRow}>
                      <Text style={styles.officerLabel}>Current Internal Status:</Text>
                      <Text style={styles.officerValueHighlight}>
                        {officerView.currentStatus}
                      </Text>
                    </View>

                    <View style={styles.officerRow}>
                      <Text style={styles.officerLabel}>Public Reporter Summary:</Text>
                      <Text style={styles.officerValue}>
                        {`"${officerView.publicReporterSummary}"`}
                      </Text>
                    </View>

                    <View style={styles.officerRow}>
                      <Text style={styles.officerLabel}>Last Status Transition:</Text>
                      <Text style={styles.officerValue}>
                        {new Date(officerView.lastStatusChange).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.officerRow}>
                      <Text style={styles.officerLabel}>Checker Notes:</Text>
                      <Text style={styles.officerNotesBox}>
                        {officerView.checkerNotes}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* ------------------------------------------------------------- */}
          {/* COMMON: TOP FILE HEADER CARD & STATUS TIMELINE               */}
          {/* ------------------------------------------------------------- */}
          <View style={styles.magicFileHeaderCard}>
            <View style={styles.magicFileHeaderTop}>
              <View style={styles.magicIconBox}>
                <Text style={styles.magicIconText}>
                  {record.fileName.endsWith(".pdf") ? "📄" : "🖼️"}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.magicFileName}>{record.fileName}</Text>
                <Text style={styles.magicFileSub}>
                  {formatBytes(record.fileSizeBytes)} · uploaded{" "}
                  {new Date(record.uploadDate).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  - {new Date(record.uploadDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>

            {/* Pill Badges */}
            <View style={styles.magicBadgeRow}>
              <View
                style={[
                  styles.magicPendingPill,
                  record.validationStatus === "validated" && { backgroundColor: "#D1FAE5" },
                  record.validationStatus === "rejected" && { backgroundColor: "#FEE2E2" },
                  record.validationStatus === "under_review" && { backgroundColor: "#E0F2FE" },
                ]}
              >
                <Text
                  style={[
                    styles.magicPendingPillText,
                    record.validationStatus === "validated" && { color: "#065F46" },
                    record.validationStatus === "rejected" && { color: "#991B1B" },
                    record.validationStatus === "under_review" && { color: "#0369A1" },
                  ]}
                >
                  Status: {record.validationStatus}
                </Text>
              </View>

              <View style={styles.magicCriticalPill}>
                <Text style={styles.magicCriticalPillText}>🔴 Critical priority</Text>
              </View>
            </View>
          </View>

          {/* JN-174 & JN-175: VISUAL STATUS TIMELINE & AUDIT HISTORY */}
          <EvidenceStatusTimeline
            currentStatus={record.validationStatus}
            statusHistory={record.statusHistory}
            lastChangedAt={record.lastStatusChangedAt}
          />

          {/* 1. SAFE EVIDENCE PREVIEW SECTION */}
          <EvidenceSafePreview record={record} isAuthorized={isAuthorized} />

          {/* 2. FILE INFORMATION CARD (Magic Patterns Table) */}
          <View style={styles.magicSectionCard}>
            <Text style={styles.magicSectionTitle}>File information</Text>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>File name</Text>
              <Text style={styles.magicTableValueBold}>{record.fileName}</Text>
            </View>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>Type</Text>
              <Text style={styles.magicTableValue}>
                {record.fileType.startsWith("image/")
                  ? "photo"
                  : record.fileType.endsWith("pdf")
                  ? "document"
                  : record.fileType}
              </Text>
            </View>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>Size</Text>
              <Text style={styles.magicTableValue}>{formatBytes(record.fileSizeBytes)}</Text>
            </View>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>Upload date</Text>
              <Text style={styles.magicTableValue}>
                {new Date(record.uploadDate).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {new Date(record.uploadDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>

            <View style={[styles.magicTableRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.magicTableLabel}>Uploaded by</Text>
              <Text style={styles.magicTableValue}>
                {record.reporterInfo?.fullName || "Reporter (identified)"}
              </Text>
            </View>
          </View>

          {/* 3. RELATED CASE INFORMATION CARD */}
          <View style={styles.magicSectionCard}>
            <Text style={styles.magicSectionTitle}>Related case information</Text>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>Case Reference</Text>
              <Text style={styles.magicTableValueHighlight}>
                {record.caseInfo?.caseReference || record.caseId || "UNLINKED"}
              </Text>
            </View>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>Case Title</Text>
              <Text style={styles.magicTableValueBold}>
                {record.caseInfo?.title || "Detention & Human Rights Investigation"}
              </Text>
            </View>

            <View style={styles.magicTableRow}>
              <Text style={styles.magicTableLabel}>Violation Category</Text>
              <Text style={styles.magicTableValue}>
                {record.caseInfo?.category || "Civil Rights & Physical Integrity"}
              </Text>
            </View>

            {record.caseInfo?.incidentLocation && (
              <View style={styles.magicTableRow}>
                <Text style={styles.magicTableLabel}>Incident Location</Text>
                <Text style={styles.magicTableValue}>{record.caseInfo.incidentLocation}</Text>
              </View>
            )}

            {record.caseInfo?.incidentDate && (
              <View style={[styles.magicTableRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.magicTableLabel}>Incident Date / Time</Text>
                <Text style={styles.magicTableValue}>{record.caseInfo.incidentDate}</Text>
              </View>
            )}
          </View>

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
            {record.validationStatus === "pending" && (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#0284C7" }]}
                onPress={handleMarkUnderReview}
                accessibilityRole="button"
              >
                <Text style={styles.validateBtnText}>
                  🔎 Begin Examination (Mark Under Review)
                </Text>
              </Pressable>
            )}

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

  // Header (Magic Patterns White Header)
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  headerInner: {
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mobileContainer: {
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },

  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },

  backBtnText: {
    color: "#2563EB",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 24,
  },

  headerTitleBox: {
    alignItems: "center",
  },

  headerTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },

  headerSub: {
    color: "#64748B",
    fontSize: 11.5,
    marginTop: 2,
  },

  // Magic Patterns Card Components
  magicFileHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },

  magicFileHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  magicIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  magicIconText: {
    fontSize: 20,
  },

  magicFileName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },

  magicFileSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },

  magicBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  magicPendingPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  magicPendingPillText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "700",
  },

  magicCriticalPill: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  magicCriticalPillText: {
    color: "#991B1B",
    fontSize: 11,
    fontWeight: "700",
  },

  magicSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },

  magicSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },

  magicTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  magicTableLabel: {
    fontSize: 12.5,
    color: "#64748B",
  },

  magicTableValue: {
    fontSize: 12.5,
    color: "#0F172A",
  },

  magicTableValueBold: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },

  magicTableValueHighlight: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
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

  // Authorization & Role Bar
  authBarCard: {
    backgroundColor: colors.navy[900],
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  authBarTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  authBadge: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },

  authBadgeIcon: {
    fontSize: 16,
    marginRight: 6,
  },

  authBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "700",
  },

  authToggleBtn: {
    backgroundColor: colors.teal[700],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },

  authToggleText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: "700",
  },

  // Role Tab Switcher
  roleTabRow: {
    flexDirection: "row",
    marginTop: 10,
    backgroundColor: colors.navy[900] || "#0B132B",
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },

  roleTabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },

  roleTabBtnActive: {
    backgroundColor: colors.royal[600],
  },

  roleTabText: {
    color: colors.navy[300],
    fontSize: 11,
    fontWeight: "600",
  },

  roleTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Reporter Public View Card
  reporterViewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },

  reporterViewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  reporterViewSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 12,
  },

  reporterStatusBox: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  reporterStatusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },

  reporterStatusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  reporterDescText: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 18,
  },

  reporterActionCallout: {
    marginTop: 10,
    backgroundColor: "#FEF9C3",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
  },

  reporterActionCalloutTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#854D0E",
  },

  reporterActionCalloutSub: {
    fontSize: 11.5,
    color: "#713F12",
    marginTop: 2,
  },

  // Officer View Card
  officerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },

  officerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  officerSub: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 12,
  },

  officerGrid: {
    gap: 8,
  },

  officerRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  officerLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 2,
  },

  officerValue: {
    fontSize: 12.5,
    color: "#0F172A",
  },

  officerValueHighlight: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
  },

  officerNotesBox: {
    fontSize: 12,
    color: "#334155",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 6,
    marginTop: 2,
  },

  // Case Grid & Metadata
  caseGrid: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  caseDetailBox: {
    marginBottom: 8,
  },

  caseLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[600],
    marginBottom: 2,
  },

  caseValueHighlight: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.royal[700],
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  urgencyBadge: {
    backgroundColor: "#FEE2E2",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  urgencyBadgeText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: "800",
  },

  caseRowFull: {
    marginVertical: 4,
  },

  caseTitleText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.navy[900],
  },

  caseCategoryText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.teal[700],
  },

  caseMetaText: {
    fontSize: 12,
    color: colors.navy[800],
  },

  reporterDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },

  reporterNameText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[900],
  },

  reporterSubText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
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
