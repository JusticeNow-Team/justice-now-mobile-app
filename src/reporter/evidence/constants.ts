import { EvidenceCategory, EvidenceType } from "./types";

export const MAX_EVIDENCE_BYTES = 100 * 1024 * 1024;

export const EVIDENCE_BUCKET =
  process.env.EXPO_PUBLIC_EVIDENCE_BUCKET || "case-evidence";

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "mp4", "m4a", "pdf"] as const;

export const CATEGORY_ACCEPT: Record<
  EvidenceCategory,
  { label: string; icon: string; mimeTypes: string[]; extensions: string[] }
> = {
  photo: {
    label: "Photo",
    icon: "📷",
    mimeTypes: ["image/jpeg", "image/jpg", "image/png"],
    extensions: ["jpg", "jpeg", "png"],
  },
  video: {
    label: "Video",
    icon: "🎥",
    mimeTypes: ["video/mp4"],
    extensions: ["mp4"],
  },
  audio: {
    label: "Audio",
    icon: "🎤",
    mimeTypes: [
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/aac",
      "audio/*",
    ],
    extensions: ["m4a"],
  },
  document: {
    label: "Document",
    icon: "📄",
    mimeTypes: ["application/pdf"],
    extensions: ["pdf"],
  },
};

export const CATEGORY_TO_TYPE: Record<EvidenceCategory, EvidenceType> = {
  photo: "image",
  video: "video",
  audio: "audio",
  document: "document",
};

export const FILE_LIMIT_HINT = "Up to 100 MB per file · JPG, PNG, MP4, M4A, PDF";
