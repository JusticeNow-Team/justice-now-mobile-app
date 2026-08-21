export type EvidenceValidationStatus =
  | "pending"
  | "validated"
  | "rejected"
  | "info_requested";

export type EvidenceCategory = "photo" | "video" | "audio" | "document";

export type PreviewKind = "image" | "document" | "audio" | "video" | "unsupported";

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
  checkerNotes?: string;
  validatedAt?: string;
  validatedBy?: string;
  controlledDownloadLogs?: ControlledDownloadLog[];
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
  | "validated"
  | "rejected"
  | "invalid_metadata"
  | "storage_insecure";

export interface CheckerSummaryStats {
  totalCount: number;
  pendingCount: number;
  validatedCount: number;
  rejectedCount: number;
  invalidMetadataCount: number;
  storageInsecureCount: number;
}

