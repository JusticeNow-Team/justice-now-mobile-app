export type EvidenceValidationStatus =
  | "pending"
  | "validated"
  | "rejected"
  | "info_requested";

export type EvidenceCategory = "photo" | "video" | "audio" | "document";

export interface CaseLinkInfo {
  id: string;
  caseReference: string;
  title: string;
  category?: string;
}

export interface ReporterLinkInfo {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  isAnonymous?: boolean;
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
  
  // Linked metadata details
  caseInfo?: CaseLinkInfo;
  reporterInfo?: ReporterLinkInfo;
  
  // Optional storage details
  storageBucket?: string;
  storagePath?: string;
  description?: string;
  rejectionReason?: string;
  checkerNotes?: string;
  validatedAt?: string;
  validatedBy?: string;
}

export interface CriteriaAudit {
  hasUniqueId: boolean;
  hasCaseLink: boolean;
  hasReporterLink: boolean;
  hasRecordedAttributes: boolean;
  isAllowedFileType: boolean;
  isWithinMaxFileSize: boolean;
  isNonEmptyFile: boolean;
  isMetadataValid: boolean;
  isDefaultPendingStatus: boolean;
}

export interface MetadataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  audit: CriteriaAudit;
  testedAt: string;
}

export type CheckerFilterTab =
  | "all"
  | "pending"
  | "validated"
  | "rejected"
  | "invalid_metadata";

export interface CheckerSummaryStats {
  totalCount: number;
  pendingCount: number;
  validatedCount: number;
  rejectedCount: number;
  invalidMetadataCount: number;
}
