import {
  ALLOWED_EXTENSIONS,
  CATEGORY_ACCEPT,
  MAX_EVIDENCE_BYTES,
} from "./constants";
import { EvidenceCategory } from "./types";

export function fileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function formatEvidenceBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateEvidenceFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: EvidenceCategory;
}): string | null {
  const extension = fileExtension(input.fileName);
  const allowed = CATEGORY_ACCEPT[input.category];
  const mime = input.mimeType.toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF.";
  }

  if (!allowed.extensions.includes(extension)) {
    return `Choose a ${allowed.label.toLowerCase()} file (${allowed.extensions
      .join(", ")
      .toUpperCase()}).`;
  }

  const mimeLooksGeneric =
    !mime ||
    mime === "application/octet-stream" ||
    mime === "application/binary" ||
    mime === "audio/*" ||
    mime.endsWith("/*");

  if (!mimeLooksGeneric && !allowed.mimeTypes.includes(mime)) {
    return `Choose a ${allowed.label.toLowerCase()} file (${allowed.extensions
      .join(", ")
      .toUpperCase()}).`;
  }

  if (input.sizeBytes <= 0) {
    return "JusticeNow could not read the size of this file. Please try another file.";
  }

  if (input.sizeBytes > MAX_EVIDENCE_BYTES) {
    return "This file is larger than 100 MB. Choose a smaller file.";
  }

  return null;
}
