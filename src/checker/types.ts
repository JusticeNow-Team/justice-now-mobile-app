export type EvidenceStatus =
  | "pending"
  | "under_review"
  | "validated"
  | "approved"
  | "info_requested"
  | "rejected"
  | "archived";

// Backwards compatibility alias
export type EvidenceValidationStatus = EvidenceStatus;

export type EvidenceCategory = "photo" | "video" | "audio" | "document";

export type PreviewKind = "image" | "document" | "audio" | "video" | "unsupported";

export interface StatusHistoryRecord {
  id: string;
  evidenceId: string;
  fromStatus: EvidenceStatus;
  toStatus: EvidenceStatus;
  changedAt: string; // ISO timestamp
  changedByRole: "checker" | "case_officer" | "system" | "reporter";
  changedById?: string;
  changedByName?: string;
  notes?: string;
  rejectionReason?: string;
}

export interface PublicStatusInfo {
  publicLabel: string;
  publicDescription: string;
  badgeBg: string;
  badgeFg: string;
  actionRequiredForReporter: boolean;
}

export interface CaseLinkInfo {
  id: string;
  caseReference: string;
  title: string;
  category?: string;
  incidentDate?: string;
  incidentLocation?: string;
  status?: string;
  urgencyLevel?: "Low" | "Medium" | "High" | "Critical";
}

export interface ReporterLinkInfo {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role?: string;
  organization?: string;
  isAnonymous?: boolean;
}

export interface ControlledDownloadLog {
  downloadId: string;
  evidenceId: string;
  checkerId: string;
  timestamp: string;
  reason: string;
  oneTimeToken: string;
  tokenExpirySeconds: number;
}

export type CommonRejectionReasonKey =
  | "unreadable_low_quality"
  | "duplicate_submission"
  | "file_manipulation"
  | "irrelevant_evidence"
  | "missing_metadata"
  | "unsupported_format"
  | "other_custom";

export interface CommonRejectionReasonItem {
  id: CommonRejectionReasonKey;
  label: string;
  description: string;
}

export const COMMON_REJECTION_REASONS: CommonRejectionReasonItem[] = [
  {
    id: "unreadable_low_quality",
    label: "Low Resolution / Unreadable Media",
    description: "The photo, video, audio, or document text is blurry, truncated, or illegible.",
  },
  {
    id: "duplicate_submission",
    label: "Duplicate Evidence Submission",
    description: "This exact evidence file or record has already been uploaded for this case.",
  },
  {
    id: "file_manipulation",
    label: "File Manipulation / Tampering Suspected",
    description: "Metadata or media payload shows signs of unauthorized alteration or editing.",
  },
  {
    id: "irrelevant_evidence",
    label: "Irrelevant to Case Allegations",
    description: "Content does not relate to or support the reported human rights violation.",
  },
  {
    id: "missing_metadata",
    label: "Missing Origin / Timestamp Metadata",
    description: "Essential location, date, or chain-of-custody metadata is missing.",
  },
  {
    id: "unsupported_format",
    label: "Unsupported / Invalid File Format",
    description: "File extension or mime type does not conform to accepted system formats.",
  },
  {
    id: "other_custom",
    label: "Other / Custom Reason",
    description: "Specific reason detailed in the custom checker notes.",
  },
];

export interface EvidenceVerificationRecord {
  decisionId: string;
  evidenceId: string;
  assignmentId?: string;
  decision: EvidenceValidationStatus;
  reason: string;
  commonRejectionReason?: string;
  internalComment?: string;
  publicFeedback?: string;
  checkerId: string;
  checkerName: string;
  checkerRole?: string;
  completedAt: string; // ISO date string
  isLocked: boolean;
}

export type ClarificationRequestType = "replacement" | "clarification";

export interface ClarificationRequestRecord {
  requestId: string;
  evidenceId: string;
  caseId: string;
  requestType: ClarificationRequestType;
  reasonCategory?: string;
  reason: string; // Mandatory reason
  internalNotes?: string;
  reporterInstructions: string; // Mandatory reporter-facing message
  requestedByCheckerId: string;
  requestedByCheckerName: string;
  assignedOfficerId?: string;
  workflowStatus: "pending_officer_review" | "relayed_to_reporter" | "fulfilled";
  requestedAt: string; // ISO date string
  replacementEvidenceId?: string; // Linked replacement evidence ID
}

export interface EvidenceRecord {
  id: string; // Unique identifier (e.g. UUID or EVD-2026-XXXX)
  caseId: string;
  reporterId: string;
  fileName: string;
  fileType: string; // mimeType (e.g. image/jpeg, application/pdf)
  evidenceType: string; // image, video, audio, document
  fileSizeBytes: number;
  uploadDate: string; // ISO date string
  validationStatus: EvidenceValidationStatus;

  // Storage & Security Metadata (Secure Evidence Storage Criteria)
  storageBucket?: string;
  storagePath?: string;
  isPrivateBucket?: boolean;
  signedUrlExpirySeconds?: number;
  localPathExposed?: boolean;
  fileExistsInStorage?: boolean;

  // Safe Preview Data
  previewUrl?: string; // Safe mock image/document URI
  documentPageCount?: number;
  documentSnippet?: string;
  mediaDurationSeconds?: number;

  // Linked metadata details
  caseInfo?: CaseLinkInfo;
  reporterInfo?: ReporterLinkInfo;

  description?: string;
  rejectionReason?: string;
  commonRejectionReason?: string;
  internalComment?: string;
  publicFeedback?: string;
  checkerNotes?: string;
  validatedAt?: string;
  validatedBy?: string;
  controlledDownloadLogs?: ControlledDownloadLog[];

  // JN-185 & JN-186 Assignment Details
  assignedCheckerId?: string;
  assignedAt?: string;
  assignedByName?: string;
  assignmentStatus?: string;
  // JN-198 & JN-204 Verification Record & Lock Protection
  verificationRecord?: EvidenceVerificationRecord;
  isLocked?: boolean;

  // JN-214 to JN-219 Clarification & Replacement Request Additions
  clarificationRequests?: ClarificationRequestRecord[];
  activeClarificationRequest?: ClarificationRequestRecord;
  replacesEvidenceId?: string; // Link to original evidence if this record is a replacement upload
  replacedByEvidenceId?: string; // Link to replacement evidence file uploaded in response to request

  // JN-170 Track Evidence Status Additions
  statusHistory?: StatusHistoryRecord[];
  lastStatusChangedAt?: string;
}

export interface CriteriaAudit {
  // Original 8 Criteria
  hasUniqueId: boolean;
  hasCaseLink: boolean;
  hasReporterLink: boolean;
  hasRecordedAttributes: boolean;
  isAllowedFileType: boolean;
  isWithinMaxFileSize: boolean;
  isNonEmptyFile: boolean;
  isMetadataValid: boolean;
  isDefaultPendingStatus: boolean;

  // New Secure Evidence Storage Criteria
  isStoredInPrivatePath: boolean;
  isLinkedToCorrectCasePath: boolean;
  hasCollisionProofFileName: boolean;
  isProtectedFromUnauthorizedAccess: boolean;
  handlesMissingFileErrors: boolean;
  preventsIncompleteUploadRecords: boolean;
  doesNotExposeLocalServerPaths: boolean;

  // Safe Preview & Controlled Access Criteria
  isSupportedPreview: boolean;
  offersControlledDownloadForUnsupported: boolean;
  preventsPublicUrlExposure: boolean;
}

export interface MetadataValidationResult {
  isValid: boolean;
  isStorageSecure: boolean;
  previewKind: PreviewKind;
  errors: string[];
  warnings: string[];
  securityCallouts: string[];
  audit: CriteriaAudit;
  testedAt: string;
}

export type CheckerFilterTab =
  | "all"
  | "pending"
  | "under_review"
  | "completed"
  | "validated"
  | "rejected"
  | "archived"
  | "invalid_metadata"
  | "storage_insecure";

export interface StorageAccessPolicy {
  bucketName: string;
  isPrivate: boolean;
  allowedRoles: string[];
  maxSignedUrlDurationSeconds: number;
}

export interface SignedUrlResponse {
  success: boolean;
  signedUrl?: string;
  expiresAt?: string;
  error?: string;
}

export interface UploadTransactionResult {
  success: boolean;
  record?: EvidenceRecord;
  rolledBack?: boolean;
  error?: string;
}

export interface CheckerSummaryStats {
  totalCount: number;
  pendingCount: number;
  underReviewCount: number;
  validatedCount: number;
  rejectedCount: number;
  archivedCount: number;
  invalidMetadataCount: number;
  storageInsecureCount: number;
}

