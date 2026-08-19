import { supabase } from "../../lib/supabase";
import { CATEGORY_TO_TYPE, EVIDENCE_BUCKET } from "./constants";
import { PendingEvidenceFile } from "./types";
import { validateEvidenceFile } from "./validation";

export type UploadEvidenceResult =
  | { ok: true; evidenceId: string }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "invalid" | "generic";
      message: string;
    };

function safeFileName(name: string) {
  const trimmed = name.replace(/[/\\]/g, "_").replace(/[^\w.-]/g, "_");
  return trimmed.slice(0, 80) || "evidence";
}

async function readFileBody(uri: string) {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error("Could not read the selected file.");
  }

  return response.blob();
}

function mapStorageError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("bucket") || lower.includes("not found")) {
    return "Evidence storage is not available yet. Please try again later.";
  }

  if (lower.includes("too large") || lower.includes("maximum")) {
    return "This file is larger than 100 MB. Choose a smaller file.";
  }

  if (lower.includes("mime") || lower.includes("type")) {
    return "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF.";
  }

  return message || "JusticeNow could not store this file. Please try again.";
}

async function requireReporterCase(caseId: string) {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false as const,
      reason: "unauthenticated" as const,
      message: "Please sign in to upload evidence.",
    };
  }

  const user = sessionData.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "reporter") {
    return {
      ok: false as const,
      reason: "unauthenticated" as const,
      message: "Only a signed-in reporter can upload evidence.",
    };
  }

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (!caseRow) {
    return {
      ok: false as const,
      reason: "forbidden" as const,
      message: "This case does not belong to your account.",
    };
  }

  return { ok: true as const, user };
}

export async function uploadEvidenceToCase(
  caseId: string,
  file: PendingEvidenceFile,
  onProgress?: (progress: number) => void
): Promise<UploadEvidenceResult> {
  const invalid = validateEvidenceFile({
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    category: file.category,
  });

  if (invalid) {
    return { ok: false, reason: "invalid", message: invalid };
  }

  const access = await requireReporterCase(caseId);

  if (!access.ok) {
    return access;
  }

  onProgress?.(15);

  let body: Blob;

  try {
    body = await readFileBody(file.uri);
  } catch {
    return {
      ok: false,
      reason: "generic",
      message: "JusticeNow could not read this file. Please try another file.",
    };
  }

  if (body.size > 0 && body.size !== file.sizeBytes) {
    const sizeError = validateEvidenceFile({
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: body.size,
      category: file.category,
    });

    if (sizeError) {
      return { ok: false, reason: "invalid", message: sizeError };
    }
  }

  onProgress?.(35);

  const storagePath = `${access.user.id}/${caseId}/${Date.now()}-${safeFileName(file.fileName)}`;

  const { error: storageError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, body, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (storageError) {
    return {
      ok: false,
      reason: "generic",
      message: mapStorageError(storageError.message),
    };
  }

  onProgress?.(80);

  const description = file.description.trim();
  const payload = {
    case_id: caseId,
    evidence_type: CATEGORY_TO_TYPE[file.category],
    title: description || file.fileName,
    description: description || null,
    file_name: file.fileName,
    storage_bucket: EVIDENCE_BUCKET,
    storage_path: storagePath,
    mime_type: file.mimeType,
    file_size_bytes: body.size || file.sizeBytes,
    validation_status: "pending",
  };

  const { data, error } = await supabase
    .from("case_evidence")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath]);

    return {
      ok: false,
      reason: "generic",
      message:
        error?.message ||
        "The file was stored, but JusticeNow could not link it to this case. Please try again.",
    };
  }

  onProgress?.(100);

  return { ok: true, evidenceId: data.id };
}

export async function uploadPendingEvidence(
  caseId: string,
  files: PendingEvidenceFile[],
  onFileProgress?: (localId: string, progress: number) => void
) {
  let uploaded = 0;
  let failed = 0;
  let lastError = "";

  for (const file of files) {
    const result = await uploadEvidenceToCase(caseId, file, (progress) => {
      onFileProgress?.(file.localId, progress);
    });

    if (result.ok) {
      uploaded += 1;
    } else {
      failed += 1;
      lastError = result.message;
    }
  }

  return { uploaded, failed, lastError };
}
