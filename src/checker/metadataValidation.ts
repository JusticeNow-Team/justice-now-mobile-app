import { EvidenceRecord, MetadataValidationResult } from "./types";

export const MAX_EVIDENCE_BYTES = 100 * 1024 * 1024; // 100 MB in bytes

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "mp4", "m4a", "pdf"] as const;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "video/mp4",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "application/pdf",
] as const;

export function extractFileExtension(fileName: string): string {
  if (!fileName || typeof fileName !== "string") return "";
  const parts = fileName.trim().toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Enforces all 8 Acceptance Criteria on an Evidence Record:
 * 1. Unique identifier present
 * 2. Linked to case and reporter
 * 3. File name, type, size, upload date, status recorded
 * 4. Allowed file types defined (JPG, PNG, MP4, M4A, PDF)
 * 5. Maximum file size defined (100 MB)
 * 6. Unsupported files rejected
 * 7. Empty or invalid metadata rejected
 * 8. New evidence receives default Pending status
 */
export function validateEvidenceMetadata(
  record: Partial<EvidenceRecord>
): MetadataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Criteria 1: Unique Identifier
  const hasUniqueId = Boolean(
    record.id && typeof record.id === "string" && record.id.trim().length > 0
  );
  if (!hasUniqueId) {
    errors.push("Missing unique evidence identifier (id).");
  }

  // Criteria 2: Linked to Case and Reporter
  const hasCaseId = Boolean(
    (record.caseId && typeof record.caseId === "string" && record.caseId.trim().length > 0) ||
      (record.caseInfo?.id && record.caseInfo.id.trim().length > 0)
  );
  if (!hasCaseId) {
    errors.push("Evidence is not linked to a valid Case.");
  }

  const hasReporterId = Boolean(
    (record.reporterId && typeof record.reporterId === "string" && record.reporterId.trim().length > 0) ||
      (record.reporterInfo?.id && record.reporterInfo.id.trim().length > 0)
  );
  if (!hasReporterId) {
    errors.push("Evidence is not linked to a registered Reporter.");
  }

  const hasCaseLink = hasCaseId;
  const hasReporterLink = hasReporterId;

  // Criteria 3: File name, file type, size, upload date, and status recorded
  const hasFileName = Boolean(
    record.fileName && typeof record.fileName === "string" && record.fileName.trim().length > 0
  );
  if (!hasFileName) {
    errors.push("File name is missing or empty.");
  }

  const hasFileType = Boolean(
    record.fileType && typeof record.fileType === "string" && record.fileType.trim().length > 0
  );
  if (!hasFileType) {
    errors.push("File type (MIME type) is missing or empty.");
  }

  const hasUploadDate = Boolean(
    record.uploadDate && typeof record.uploadDate === "string" && record.uploadDate.trim().length > 0
  );
  if (!hasUploadDate) {
    errors.push("Upload date timestamp is missing.");
  }

  const hasStatusRecorded = Boolean(record.validationStatus);
  if (!hasStatusRecorded) {
    errors.push("Evidence validation status is not recorded.");
  }

  const isNonEmptyFile = typeof record.fileSizeBytes === "number" && record.fileSizeBytes > 0;
  if (!isNonEmptyFile) {
    errors.push("File size is 0 bytes or unreadable (empty file).");
  }

  const hasRecordedAttributes =
    hasFileName && hasFileType && hasUploadDate && hasStatusRecorded && isNonEmptyFile;

  // Criteria 4 & 6: Allowed File Types & Unsupported Files Rejection
  const ext = extractFileExtension(record.fileName || "");
  const mime = (record.fileType || "").toLowerCase().trim();

  const extIsAllowed = ALLOWED_EXTENSIONS.includes(ext as any);
  const mimeIsAllowed =
    ALLOWED_MIME_TYPES.includes(mime as any) ||
    mime.startsWith("image/jpeg") ||
    mime.startsWith("image/png") ||
    mime.startsWith("video/mp4") ||
    mime.startsWith("audio/mp4") ||
    mime.startsWith("application/pdf");

  const isAllowedFileType = extIsAllowed && (mimeIsAllowed || mime === "");
  if (!extIsAllowed) {
    errors.push(
      `Unsupported file extension '.${ext || "unknown"}'. Allowed formats: JPG, PNG, MP4, M4A, PDF.`
    );
  } else if (!mimeIsAllowed && mime !== "") {
    warnings.push(`Unusual MIME type '${mime}' for extension '.${ext}'.`);
  }

  // Criteria 5: Maximum File Size (100 MB)
  const fileSizeBytes = record.fileSizeBytes || 0;
  const isWithinMaxFileSize = fileSizeBytes <= MAX_EVIDENCE_BYTES;
  if (fileSizeBytes > MAX_EVIDENCE_BYTES) {
    errors.push(
      `File size (${formatBytes(fileSizeBytes)}) exceeds maximum allowed limit of 100 MB.`
    );
  }

  // Criteria 8: Default Pending Status for New Evidence
  const isDefaultPendingStatus = record.validationStatus === "pending";
  if (!isDefaultPendingStatus && record.validationStatus) {
    warnings.push(
      `Evidence status is currently '${record.validationStatus}'. Newly created evidence must default to 'pending'.`
    );
  }

  // Criteria 7: Empty or Invalid Evidence Metadata Rejected
  const isMetadataValid = errors.length === 0;

  return {
    isValid: isMetadataValid,
    errors,
    warnings,
    testedAt: new Date().toISOString(),
    audit: {
      hasUniqueId,
      hasCaseLink,
      hasReporterLink,
      hasRecordedAttributes,
      isAllowedFileType,
      isWithinMaxFileSize,
      isNonEmptyFile,
      isMetadataValid,
      isDefaultPendingStatus,
    },
  };
}
