export type EvidenceCategory = "photo" | "video" | "audio" | "document";

export type EvidenceType = "image" | "video" | "audio" | "document";

export interface PendingEvidenceFile {
  localId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: EvidenceCategory;
  description: string;
}

export type EvidenceUploadPhase =
  | "ready"
  | "uploading"
  | "uploaded"
  | "error";

export interface EvidenceUploadStatus {
  progress: number;
  phase: EvidenceUploadPhase;
  error?: string;
}
