import * as DocumentPicker from "expo-document-picker";

import { CATEGORY_ACCEPT } from "./constants";
import { EvidenceCategory, PendingEvidenceFile } from "./types";
import { validateEvidenceFile } from "./validation";

function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PickEvidenceResult =
  | { ok: true; file: PendingEvidenceFile }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "invalid"; message: string };

export async function pickEvidenceFile(
  category: EvidenceCategory
): Promise<PickEvidenceResult> {
  const accept = CATEGORY_ACCEPT[category];

  const result = await DocumentPicker.getDocumentAsync({
    type: accept.mimeTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, reason: "cancelled" };
  }

  const asset = result.assets[0];
  const fileName = asset.name || `evidence.${accept.extensions[0]}`;
  const mimeType = asset.mimeType || "";
  let sizeBytes = asset.size ?? 0;

  if (sizeBytes <= 0) {
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      sizeBytes = blob.size;
    } catch {
      return {
        ok: false,
        reason: "invalid",
        message: "JusticeNow could not read this file. Please try another file.",
      };
    }
  }

  const invalid = validateEvidenceFile({
    fileName,
    mimeType,
    sizeBytes,
    category,
  });

  if (invalid) {
    return { ok: false, reason: "invalid", message: invalid };
  }

  return {
    ok: true,
    file: {
      localId: newLocalId(),
      uri: asset.uri,
      fileName,
      mimeType: mimeType || `application/${accept.extensions[0]}`,
      sizeBytes,
      category,
      description: "",
    },
  };
}
