import { Image } from "expo-image";
import { Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../components/AppIcon";
import { useAppFeedback } from "../components/common";
import {
  EvidenceRecord,
  EvidenceStatus,
  MetadataValidationResult,
  PreviewKind,
  StatusHistoryRecord,
} from "./audit/types";
import {
  formatBytes as formatAuditBytes,
  MAX_EVIDENCE_BYTES,
  simulatePublicUrlAccess,
  validateEvidenceMetadata,
} from "./audit/metadataValidation";
import {
  getCaseOfficerStatusView,
  getPublicStatusForReporter,
} from "./audit/statusTransitionService";
import { colors, iconSizes } from "../theme";
import { createEvidenceSignedUrl } from "./api";
import {
  formatBytes,
  formatDateTime,
  formatLabel,
  SectionCard,
  StatusBadge,
  ValidatorHeader,
} from "./components";
import { ValidatorEvidenceItem } from "./types";

type RoleView = "checker" | "case_officer" | "reporter";

type SimulatorForm = Partial<EvidenceRecord>;

const PRESET_SCENARIOS: {
  name: string;
  icon: AppIconName;
  payload: SimulatorForm;
}[] = [
  {
    name: "Valid photo",
    icon: "check-circle",
    payload: {
      id: "EVD-SIM-1001",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "scene_photo_evidence.png",
      fileType: "image/png",
      evidenceType: "image",
      fileSizeBytes: 3500000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      isPrivateBucket: true,
      storageBucket: "case-evidence",
      storagePath: "cases/CASE-2026-0812/evidence/EVD-SIM-1001_scene_photo_evidence.png",
      caseInfo: {
        id: "CASE-2026-0812",
        caseReference: "JN-2026-0812",
        title: "Detention case",
      },
      reporterInfo: {
        id: "REP-4402",
        fullName: "Protected Reporter",
      },
    },
  },
  {
    name: "Unsupported file",
    icon: "circle-x",
    payload: {
      id: "EVD-SIM-1002",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "unsupported_binary_payload.exe",
      fileType: "application/x-msdownload",
      evidenceType: "document",
      fileSizeBytes: 12000000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
    },
  },
  {
    name: "Oversized video",
    icon: "alert-triangle",
    payload: {
      id: "EVD-SIM-1003",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "large_raw_video_footage.mp4",
      fileType: "video/mp4",
      evidenceType: "video",
      fileSizeBytes: 150000000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
    },
  },
  {
    name: "Missing links",
    icon: "alert-circle",
    payload: {
      id: "EVD-SIM-1004",
      caseId: "",
      reporterId: "",
      fileName: "orphan_report.pdf",
      fileType: "application/pdf",
      evidenceType: "document",
      fileSizeBytes: 1024000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
    },
  },
  {
    name: "Missing storage",
    icon: "circle-help",
    payload: {
      id: "EVD-SIM-1005",
      caseId: "CASE-2026-0812",
      reporterId: "REP-4402",
      fileName: "missing_asset.pdf",
      fileType: "application/pdf",
      evidenceType: "document",
      fileSizeBytes: 950000,
      uploadDate: new Date().toISOString(),
      validationStatus: "pending",
      fileExistsInStorage: false,
      storagePath: "cases/CASE-2026-0812/evidence/EVD-SIM-1005_missing_asset.pdf",
    },
  },
  {
    name: "Public path",
    icon: "lock",
    payload: {
      id: "EVD-SIM-1006",
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
    },
  },
];

function normalizeEvidenceStatus(item: ValidatorEvidenceItem): EvidenceStatus {
  if (item.validationStatus === "verified") {
    return "validated";
  }

  if (
    item.validationStatus === "pending" ||
    item.validationStatus === "under_review" ||
    item.validationStatus === "validated" ||
    item.validationStatus === "approved" ||
    item.validationStatus === "info_requested" ||
    item.validationStatus === "rejected" ||
    item.validationStatus === "archived"
  ) {
    return item.validationStatus;
  }

  if (item.assignmentStatus === "under_review") {
    return "under_review";
  }

  if (item.assignmentStatus === "completed") {
    return "validated";
  }

  return "pending";
}

function buildStatusHistory(item: ValidatorEvidenceItem): StatusHistoryRecord[] {
  const status = normalizeEvidenceStatus(item);
  const history: StatusHistoryRecord[] = [
    {
      id: `${item.assignmentId}-assigned`,
      evidenceId: item.evidenceId,
      fromStatus: "pending",
      toStatus: "pending",
      changedAt: item.assignedAt,
      changedByRole: "case_officer",
      changedByName: item.assignedByName,
      notes: "Evidence assigned to validation queue.",
    },
  ];

  if (item.startedAt || status !== "pending") {
    history.push({
      id: `${item.assignmentId}-started`,
      evidenceId: item.evidenceId,
      fromStatus: "pending",
      toStatus: "under_review",
      changedAt: item.startedAt || item.assignedAt,
      changedByRole: "checker",
      changedByName: "Evidence Validator",
      notes: "Evidence review opened by validator.",
    });
  }

  if (status !== "pending" && status !== "under_review") {
    history.push({
      id: `${item.assignmentId}-current`,
      evidenceId: item.evidenceId,
      fromStatus: "under_review",
      toStatus: status,
      changedAt: item.evidenceCreatedAt,
      changedByRole: "checker",
      changedByName: "Evidence Validator",
      notes: `Current validation status is ${formatLabel(status)}.`,
    });
  }

  return history;
}

export function toAuditEvidenceRecord(item: ValidatorEvidenceItem): EvidenceRecord {
  const status = normalizeEvidenceStatus(item);
  const fileName = item.fileName || item.evidenceTitle || "evidence-file";
  const storagePath =
    item.storagePath ||
    (item.storageBucket ? `cases/${item.caseId}/evidence/${item.evidenceId}_${fileName}` : undefined);

  return {
    id: item.evidenceId,
    caseId: item.caseId,
    reporterId: item.isAnonymous ? "anonymous-reporter" : "protected-reporter",
    fileName,
    fileType: item.mimeType || "application/octet-stream",
    evidenceType: item.evidenceType || "document",
    fileSizeBytes: item.fileSizeBytes ?? 0,
    uploadDate: item.evidenceCreatedAt,
    validationStatus: status,
    storageBucket: item.storageBucket || "case-evidence",
    storagePath,
    isPrivateBucket: item.storageBucket !== "public",
    signedUrlExpirySeconds: 60,
    fileExistsInStorage: Boolean(item.storageBucket && item.storagePath),
    caseInfo: {
      id: item.caseId,
      caseReference: item.caseReference,
      title: item.caseTitle,
      category: item.caseCategory,
      incidentDate: item.caseIncidentDate || undefined,
      urgencyLevel:
        item.casePriority === "urgent"
          ? "Critical"
          : item.casePriority === "high"
            ? "High"
            : item.casePriority === "medium"
              ? "Medium"
              : "Low",
    },
    reporterInfo: {
      id: item.isAnonymous ? "anonymous" : "protected",
      fullName: item.isAnonymous ? "Anonymous reporter" : "Protected reporter",
      isAnonymous: item.isAnonymous,
    },
    description: item.evidenceDescription || undefined,
    assignedAt: item.assignedAt,
    assignedByName: item.assignedByName,
    assignmentStatus: item.assignmentStatus,
    statusHistory: buildStatusHistory(item),
    lastStatusChangedAt: item.startedAt || item.assignedAt,
  };
}

export function ValidatorSafePreview({ item }: { item: ValidatorEvidenceItem }) {
  const { showFeedback } = useAppFeedback();
  const record = useMemo(() => toAuditEvidenceRecord(item), [item]);
  const validation = useMemo(() => validateEvidenceMetadata(record), [record]);
  const [revealed, setRevealed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadReason, setDownloadReason] = useState("");
  const [downloadToken, setDownloadToken] = useState("");
  const [publicUrlResult, setPublicUrlResult] = useState("");

  const previewKind = validation.previewKind;
  const hasFile = Boolean(item.storageBucket && item.storagePath);

  const openSecureUrl = async () => {
    if (!hasFile) {
      showFeedback({
        tone: "warning",
        title: "Storage file missing",
        message: "The database record exists, but no storage object is linked.",
      });
      return;
    }

    try {
      setLoadingUrl(true);
      const url = await createEvidenceSignedUrl(item, 60);

      if (previewKind === "image") {
        setPreviewUrl(url);
        setRevealed(true);
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      showFeedback({
        tone: "error",
        title: "Preview unavailable",
        message:
          error instanceof Error
            ? error.message
            : "JusticeNow could not open the secure preview.",
      });
    } finally {
      setLoadingUrl(false);
    }
  };

  const runPublicUrlTest = () => {
    const result = simulatePublicUrlAccess(record.storageBucket, record.storagePath);
    setPublicUrlResult(`${result.httpStatus}: ${result.message}`);
  };

  const requestControlledDownload = () => {
    if (downloadReason.trim().length < 8) {
      showFeedback({
        tone: "warning",
        title: "Audit reason required",
        message: "Add a short reason before generating a controlled token.",
      });
      return;
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    setDownloadToken(
      `https://justicenow-secure-vault.internal/controlled-download/${record.id}?token=DL-${Date.now()}&exp=${issuedAt + 300}`,
    );
    setDownloadModalOpen(false);
    showFeedback({
      tone: "success",
      title: "Controlled token generated",
      message: "The simulated single-use download token was audit logged.",
    });
  };

  return (
    <SectionCard
      title="Safe preview and access"
      description="Preview supported evidence through short-lived links. Unsupported files use a controlled download workflow."
    >
      {!hasFile ? (
        <View style={styles.previewWarning}>
          <AppIcon name="warning" color={colors.error} size={iconSizes.md} />
          <View style={styles.flex}>
            <Text style={styles.warningTitle}>Storage object missing</Text>
            <Text style={styles.mutedText}>
              This record has incomplete storage metadata. Re-check the case
              upload or request a replacement.
            </Text>
          </View>
        </View>
      ) : previewKind === "image" && revealed && previewUrl ? (
        <Pressable onPress={() => setRevealed(false)} style={styles.previewImageWrap}>
          <Image source={{ uri: previewUrl }} contentFit="cover" style={styles.previewImage} />
          <View style={styles.previewImageFooter}>
            <Text style={styles.previewImageFooterText}>Tap to hide preview</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.previewGate}>
          <View style={styles.previewGateIcon}>
            <AppIcon
              name={previewIcon(previewKind)}
              color={colors.navy[600]}
              size={iconSizes.xl}
            />
          </View>
          <Text style={styles.previewGateTitle}>{previewLabel(previewKind)}</Text>
          <Text style={styles.mutedText}>
            {previewKind === "unsupported"
              ? "This file type should be accessed only through a controlled, logged token."
              : "The file stays hidden until you intentionally open a temporary secure link."}
          </Text>
          <View style={styles.previewActions}>
            <Pressable
              disabled={loadingUrl || previewKind === "unsupported"}
              onPress={() => void openSecureUrl()}
              style={({ pressed }) => [
                styles.primaryAction,
                (loadingUrl || previewKind === "unsupported") && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {loadingUrl ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <AppIcon name="lock" color={colors.surface} size={iconSizes.sm} />
                  <Text style={styles.primaryActionText}>
                    {previewKind === "image" ? "Reveal preview" : "Open secure preview"}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => setDownloadModalOpen(true)}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
            >
              <AppIcon name="download" color={colors.royal[700]} size={iconSizes.sm} />
              <Text style={styles.secondaryActionText}>Controlled download</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.accessTools}>
        <Pressable
          onPress={runPublicUrlTest}
          style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
        >
          <AppIcon name="globe" color={colors.navy[700]} size={iconSizes.sm} />
          <Text style={styles.toolButtonText}>Test public URL exposure</Text>
        </Pressable>

        {publicUrlResult ? (
          <Text style={styles.toolResult}>{publicUrlResult}</Text>
        ) : null}

        {downloadToken ? (
          <View style={styles.tokenBox}>
            <Text style={styles.tokenLabel}>Active controlled token</Text>
            <Text style={styles.tokenValue}>{downloadToken}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={downloadModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDownloadModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Controlled download</Text>
            <Text style={styles.mutedText}>
              Enter an audit reason before generating a simulated single-use
              token.
            </Text>
            <TextInput
              value={downloadReason}
              onChangeText={setDownloadReason}
              placeholder="Reason for controlled access"
              placeholderTextColor={colors.textSoft}
              multiline
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDownloadModalOpen(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={requestControlledDownload}
                style={styles.modalConfirm}
              >
                <Text style={styles.modalConfirmText}>Generate token</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SectionCard>
  );
}

export function ValidatorAuditSummary({ item }: { item: ValidatorEvidenceItem }) {
  const record = useMemo(() => toAuditEvidenceRecord(item), [item]);
  const validation = useMemo(() => validateEvidenceMetadata(record), [record]);
  const [roleView, setRoleView] = useState<RoleView>("checker");

  return (
    <>
      <SectionCard
        title="Role-specific view"
        description="Check how this evidence status is summarized for each workspace."
      >
        <View style={styles.segmented}>
          <RoleTab label="Checker" selected={roleView === "checker"} onPress={() => setRoleView("checker")} />
          <RoleTab label="Officer" selected={roleView === "case_officer"} onPress={() => setRoleView("case_officer")} />
          <RoleTab label="Reporter" selected={roleView === "reporter"} onPress={() => setRoleView("reporter")} />
        </View>

        {roleView === "checker" ? (
          <View style={styles.rolePanel}>
            <Text style={styles.rolePanelTitle}>Checker audit view</Text>
            <Text style={styles.mutedText}>
              {validation.isValid
                ? "Metadata and storage checks are currently passing."
                : `${validation.errors.length} issue(s) need review before this file can be accepted.`}
            </Text>
            <View style={styles.badgeInline}>
              <StatusBadge status={record.validationStatus} />
            </View>
          </View>
        ) : roleView === "case_officer" ? (
          <OfficerView record={record} />
        ) : (
          <ReporterView record={record} />
        )}
      </SectionCard>

      <ValidatorStatusTimeline record={record} />
      <ValidatorMetadataAudit validation={validation} record={record} />
    </>
  );
}

function OfficerView({ record }: { record: EvidenceRecord }) {
  const officerView = getCaseOfficerStatusView(record);

  return (
    <View style={styles.rolePanel}>
      <Text style={styles.rolePanelTitle}>Case officer technical overview</Text>
      <InfoLine label="Chain of custody" value={officerView.isChainOfCustodyActive ? "Active" : "In progress"} />
      <InfoLine label="Internal status" value={officerView.currentStatus} />
      <InfoLine label="Reporter summary" value={officerView.publicReporterSummary} />
      <InfoLine label="Last transition" value={formatDateTime(officerView.lastStatusChange)} last />
    </View>
  );
}

function ReporterView({ record }: { record: EvidenceRecord }) {
  const publicStatus = getPublicStatusForReporter(record.validationStatus);

  return (
    <View style={styles.rolePanel}>
      <Text style={styles.rolePanelTitle}>Reporter status portal</Text>
      <View
        style={[
          styles.publicStatusBadge,
          { backgroundColor: publicStatus.badgeBg },
        ]}
      >
        <Text style={[styles.publicStatusText, { color: publicStatus.badgeFg }]}>
          {publicStatus.publicLabel}
        </Text>
      </View>
      <Text style={styles.mutedText}>{publicStatus.publicDescription}</Text>
      {publicStatus.actionRequiredForReporter ? (
        <View style={styles.actionRequiredBox}>
          <Text style={styles.actionRequiredText}>Action required from reporter</Text>
        </View>
      ) : null}
    </View>
  );
}

function ValidatorStatusTimeline({ record }: { record: EvidenceRecord }) {
  const steps: EvidenceStatus[] = ["pending", "under_review", "validated"];
  const current = record.validationStatus === "approved" ? "validated" : record.validationStatus;
  const currentIndex = steps.indexOf(current as EvidenceStatus);

  return (
    <SectionCard
      title="Status progression"
      description="A validator-native view of the checker status tracker."
    >
      <View style={styles.timelineSteps}>
        {steps.map((step, index) => {
          const active = current === step;
          const complete = currentIndex > index || current === "validated";
          return (
            <View key={step} style={styles.timelineStepWrap}>
              <View
                style={[
                  styles.timelineCircle,
                  complete && styles.timelineCircleDone,
                  active && styles.timelineCircleActive,
                ]}
              >
                <AppIcon
                  name={complete ? "check" : active ? "search" : "clock"}
                  color={complete || active ? colors.surface : colors.navy[500]}
                  size={iconSizes.xs}
                />
              </View>
              <Text style={styles.timelineLabel}>{formatLabel(step)}</Text>
            </View>
          );
        })}
      </View>

      {record.validationStatus === "rejected" || record.validationStatus === "info_requested" ? (
        <View style={styles.statusCallout}>
          <AppIcon
            name={record.validationStatus === "rejected" ? "circle-x" : "circle-help"}
            color={record.validationStatus === "rejected" ? colors.error : colors.warning}
            size={iconSizes.sm}
          />
          <Text style={styles.statusCalloutText}>
            {record.validationStatus === "rejected"
              ? "Rejected records remain locked for audit review."
              : "This evidence is waiting for additional information."}
          </Text>
        </View>
      ) : null}

      <View style={styles.historyList}>
        {(record.statusHistory || []).map((history, index) => (
          <View key={history.id} style={styles.historyItem}>
            <View style={styles.historyDot} />
            <View style={styles.flex}>
              <Text style={styles.historyText}>
                {formatLabel(history.fromStatus)} to {formatLabel(history.toStatus)}
              </Text>
              <Text style={styles.historySubText}>
                {formatDateTime(history.changedAt)} by {formatLabel(history.changedByRole)}
              </Text>
              {history.notes ? (
                <Text style={styles.mutedText}>{history.notes}</Text>
              ) : null}
            </View>
            {index === 0 ? null : <View />}
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

function ValidatorMetadataAudit({
  validation,
  record,
}: {
  validation: MetadataValidationResult;
  record: EvidenceRecord;
}) {
  const auditRows = [
    ["Unique evidence ID", validation.audit.hasUniqueId],
    ["Linked to case", validation.audit.hasCaseLink],
    ["Linked to reporter", validation.audit.hasReporterLink],
    ["Recorded file attributes", validation.audit.hasRecordedAttributes],
    ["Allowed file type", validation.audit.isAllowedFileType],
    ["File size within 100 MB", validation.audit.isWithinMaxFileSize],
    ["Valid non-empty metadata", validation.audit.isMetadataValid],
    ["Private storage path", validation.audit.isStoredInPrivatePath],
    ["Case-linked storage path", validation.audit.isLinkedToCorrectCasePath],
    ["Collision-proof file slug", validation.audit.hasCollisionProofFileName],
    ["Signed token access policy", validation.audit.isProtectedFromUnauthorizedAccess],
    ["No local path exposure", validation.audit.doesNotExposeLocalServerPaths],
  ] as const;

  return (
    <SectionCard
      title="Metadata and storage audit"
      description="Imported checker rules, rendered in the validator workspace."
    >
      <View
        style={[
          styles.auditHealth,
          validation.isValid ? styles.auditHealthValid : styles.auditHealthInvalid,
        ]}
      >
        <AppIcon
          name={validation.isValid ? "shield-check" : "shield-alert"}
          color={validation.isValid ? colors.success : colors.error}
          size={iconSizes.lg}
        />
        <View style={styles.flex}>
          <Text style={styles.auditHealthTitle}>
            {validation.isValid ? "Metadata checks passed" : "Metadata issues detected"}
          </Text>
          <Text style={styles.mutedText}>
            {validation.isStorageSecure
              ? "Storage access criteria are currently secure."
              : "Review storage access criteria before accepting this evidence."}
          </Text>
        </View>
      </View>

      <InfoLine label="Preview mode" value={previewLabel(validation.previewKind)} />
      <InfoLine label="Storage bucket" value={record.storageBucket || "Not recorded"} />
      <InfoLine label="Storage path" value={record.storagePath || "Not recorded"} />
      <InfoLine label="File size" value={formatAuditBytes(record.fileSizeBytes)} />
      <InfoLine label="Maximum allowed" value={formatAuditBytes(MAX_EVIDENCE_BYTES)} last />

      {validation.errors.length > 0 ? (
        <AuditMessageList title="Critical rules" messages={validation.errors} tone="error" />
      ) : null}

      {validation.securityCallouts.length > 0 ? (
        <AuditMessageList
          title="Security storage issues"
          messages={validation.securityCallouts}
          tone="warning"
        />
      ) : null}

      {validation.warnings.length > 0 ? (
        <AuditMessageList title="Warnings" messages={validation.warnings} tone="warning" />
      ) : null}

      <View style={styles.auditGrid}>
        {auditRows.map(([label, passed]) => (
          <View key={label} style={styles.auditPill}>
            <AppIcon
              name={passed ? "check" : "circle-x"}
              color={passed ? colors.success : colors.error}
              size={iconSizes.xs}
            />
            <Text style={styles.auditPillText}>{label}</Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

export default function ValidatorMetadataSimulatorScreen() {
  const router = useRouter();
  const [form, setForm] = useState<SimulatorForm>(PRESET_SCENARIOS[0].payload);
  const validation = useMemo(
    () => validateEvidenceMetadata(form as EvidenceRecord),
    [form],
  );

  const updateForm = (patch: SimulatorForm) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ValidatorHeader
        title="Rules simulator"
        subtitle="Metadata and secure access checks"
        backTo="/validator/dashboard"
        rightAction={
          <Pressable
            onPress={() => router.replace("/validator/queue" as Href)}
            style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
          >
            <AppIcon name="file-search" color={colors.royal[700]} size={iconSizes.sm} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard
          title="Preset test cases"
          description="Run common checker scenarios without leaving the validator workspace."
        >
          <ScrollView
            horizontal
            contentContainerStyle={styles.presetRow}
            showsHorizontalScrollIndicator={false}
          >
            {PRESET_SCENARIOS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() => setForm(preset.payload)}
                style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
              >
                <AppIcon name={preset.icon} color={colors.royal[700]} size={iconSizes.xs} />
                <Text style={styles.presetChipText}>{preset.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SectionCard>

        <View
          style={[
            styles.simResultCard,
            validation.isValid ? styles.simResultValid : styles.simResultInvalid,
          ]}
        >
          <AppIcon
            name={validation.isValid ? "check-circle" : "circle-x"}
            color={validation.isValid ? colors.success : colors.error}
            size={iconSizes.xl}
          />
          <View style={styles.flex}>
            <Text style={styles.simResultTitle}>
              {validation.isValid ? "Acceptance criteria passed" : "Acceptance criteria failed"}
            </Text>
            <Text style={styles.mutedText}>
              {validation.isValid
                ? "This evidence payload satisfies the configured rules."
                : `${validation.errors.length} blocking issue(s) detected.`}
            </Text>
          </View>
        </View>

        <SectionCard title="Custom metadata form">
          <SimulatorField
            label="Evidence ID"
            value={form.id || ""}
            onChangeText={(value) => updateForm({ id: value })}
            placeholder="EVD-2026-0001"
          />
          <SimulatorField
            label="Case ID"
            value={form.caseId || ""}
            onChangeText={(value) =>
              updateForm({
                caseId: value,
                caseInfo: value
                  ? {
                      id: value,
                      caseReference: `JN-${value}`,
                      title: "Simulator case",
                    }
                  : undefined,
              })
            }
            placeholder="CASE-2026-0812"
          />
          <SimulatorField
            label="Reporter ID"
            value={form.reporterId || ""}
            onChangeText={(value) =>
              updateForm({
                reporterId: value,
                reporterInfo: value
                  ? {
                      id: value,
                      fullName: "Protected reporter",
                    }
                  : undefined,
              })
            }
            placeholder="REP-4402"
          />
          <SimulatorField
            label="File name"
            value={form.fileName || ""}
            onChangeText={(value) => updateForm({ fileName: value })}
            placeholder="photo.jpg"
          />
          <SimulatorField
            label="MIME type"
            value={form.fileType || ""}
            onChangeText={(value) => updateForm({ fileType: value })}
            placeholder="image/jpeg"
          />
          <SimulatorField
            label="File size in bytes"
            value={String(form.fileSizeBytes ?? 0)}
            onChangeText={(value) =>
              updateForm({ fileSizeBytes: Number.parseInt(value, 10) || 0 })
            }
            placeholder="2048000"
            keyboardType="numeric"
          />
          <Text style={styles.sizeHint}>
            Formatted size: {formatBytes(form.fileSizeBytes ?? 0)}
          </Text>
        </SectionCard>

        <ValidatorMetadataAudit
          validation={validation}
          record={form as EvidenceRecord}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleTab,
        selected && styles.roleTabSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.roleTabText, selected && styles.roleTabTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoLine({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoLine, last && styles.infoLineLast]}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}

function AuditMessageList({
  title,
  messages,
  tone,
}: {
  title: string;
  messages: string[];
  tone: "error" | "warning";
}) {
  const color = tone === "error" ? colors.error : colors.warning;
  const background = tone === "error" ? "#FFF2F1" : colors.gold[50];
  const border = tone === "error" ? "#F4CECB" : colors.gold[200];

  return (
    <View style={[styles.messageList, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.messageListTitle, { color }]}>{title}</Text>
      {messages.map((message) => (
        <Text key={message} style={styles.messageListItem}>
          {message}
        </Text>
      ))}
    </View>
  );
}

function SimulatorField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.simField}>
      <Text style={styles.simFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        keyboardType={keyboardType}
        style={styles.simInput}
      />
    </View>
  );
}

function previewIcon(kind: PreviewKind): AppIconName {
  switch (kind) {
    case "image":
      return "image";
    case "audio":
      return "mic";
    case "video":
      return "video";
    case "document":
      return "file-text";
    case "unsupported":
    default:
      return "warning";
  }
}

function previewLabel(kind: PreviewKind) {
  switch (kind) {
    case "image":
      return "Image preview";
    case "document":
      return "Document preview";
    case "audio":
      return "Audio preview";
    case "video":
      return "Video preview";
    case "unsupported":
    default:
      return "Controlled download required";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  screenScroll: {
    flex: 1,
  },

  screenContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },

  flex: {
    flex: 1,
    minWidth: 0,
  },

  pressed: {
    opacity: 0.68,
  },

  disabled: {
    opacity: 0.45,
  },

  headerAction: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },

  previewWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F4CECB",
    borderRadius: 12,
    backgroundColor: "#FFF2F1",
  },

  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },

  mutedText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  previewImageWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.navy[100],
    borderRadius: 14,
    backgroundColor: colors.navy[900],
  },

  previewImage: {
    width: "100%",
    height: 230,
  },

  previewImageFooter: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.navy[800],
  },

  previewImageFooterText: {
    fontSize: 11.5,
    textAlign: "center",
    color: colors.navy[100],
  },

  previewGate: {
    alignItems: "center",
    padding: 18,
    borderWidth: 1,
    borderColor: colors.navy[100],
    borderRadius: 14,
    backgroundColor: colors.navy[50],
  },

  previewGateIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  previewGateTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },

  previewActions: {
    width: "100%",
    marginTop: 14,
    gap: 8,
  },

  primaryAction: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },

  primaryActionText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.surface,
  },

  secondaryAction: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.royal[200],
    borderRadius: 11,
    backgroundColor: colors.surface,
  },

  secondaryActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.royal[700],
  },

  accessTools: {
    marginTop: 12,
    gap: 8,
  },

  toolButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },

  toolButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[700],
  },

  toolResult: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 10,
    fontSize: 11.5,
    color: colors.teal[800],
    backgroundColor: colors.teal[50],
  },

  tokenBox: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 10,
    backgroundColor: colors.royal[50],
  },

  tokenLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.royal[700],
  },

  tokenValue: {
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.navy[700],
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10,27,46,0.55)",
  },

  modalCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },

  modalInput: {
    minHeight: 92,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 13,
    lineHeight: 19,
    textAlignVertical: "top",
    color: colors.navy[800],
  },

  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },

  modalCancel: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },

  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[700],
  },

  modalConfirm: {
    minHeight: 42,
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },

  modalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },

  segmented: {
    flexDirection: "row",
    gap: 7,
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.navy[50],
  },

  roleTab: {
    minHeight: 34,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },

  roleTabSelected: {
    backgroundColor: colors.navy[800],
  },

  roleTabText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[700],
  },

  roleTabTextSelected: {
    color: colors.surface,
  },

  rolePanel: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  rolePanelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },

  badgeInline: {
    marginTop: 10,
    alignItems: "flex-start",
  },

  publicStatusBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  publicStatusText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  actionRequiredBox: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.gold[200],
    borderRadius: 10,
    backgroundColor: colors.gold[50],
  },

  actionRequiredText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.warning,
  },

  infoLine: {
    minHeight: 38,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  infoLineLast: {
    borderBottomWidth: 0,
  },

  infoLineLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },

  infoLineValue: {
    flex: 1.25,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    color: colors.navy[800],
  },

  timelineSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  timelineStepWrap: {
    flex: 1,
    alignItems: "center",
  },

  timelineCircle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  timelineCircleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },

  timelineCircleActive: {
    borderColor: colors.royal[700],
    backgroundColor: colors.royal[700],
  },

  timelineLabel: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "center",
    color: colors.navy[700],
  },

  statusCallout: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.navy[50],
  },

  statusCalloutText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.navy[700],
  },

  historyList: {
    marginTop: 12,
    gap: 9,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },

  historyDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: colors.royal[700],
  },

  historyText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[800],
  },

  historySubText: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSoft,
  },

  auditHealth: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },

  auditHealthValid: {
    borderColor: colors.teal[100],
    backgroundColor: colors.teal[50],
  },

  auditHealthInvalid: {
    borderColor: "#F4CECB",
    backgroundColor: "#FFF2F1",
  },

  auditHealthTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },

  messageList: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },

  messageListTitle: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  messageListItem: {
    marginTop: 5,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.navy[700],
  },

  auditGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  auditPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },

  auditPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.navy[700],
  },

  presetRow: {
    gap: 8,
    paddingRight: 12,
  },

  presetChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 9,
    backgroundColor: colors.royal[50],
  },

  presetChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.royal[700],
  },

  simResultCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },

  simResultValid: {
    borderColor: colors.teal[100],
    backgroundColor: colors.teal[50],
  },

  simResultInvalid: {
    borderColor: "#F4CECB",
    backgroundColor: "#FFF2F1",
  },

  simResultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy[800],
  },

  simField: {
    marginBottom: 10,
  },

  simFieldLabel: {
    marginBottom: 5,
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[700],
  },

  simInput: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 10,
    fontSize: 13,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },

  sizeHint: {
    marginTop: -3,
    fontSize: 11,
    color: colors.textSoft,
  },
});
