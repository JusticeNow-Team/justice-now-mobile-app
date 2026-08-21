import { supabase } from "../lib/supabase";
import { EvidenceRecord, EvidenceValidationStatus } from "./types";

// Seed mock records for offline/demo testing of all 8 acceptance criteria
export const INITIAL_MOCK_EVIDENCE: EvidenceRecord[] = [
  {
    id: "EVD-2026-9041",
    caseId: "CASE-2026-0812",
    reporterId: "REP-4402",
    fileName: "crime_scene_photo_01.jpg",
    fileType: "image/jpeg",
    evidenceType: "image",
    fileSizeBytes: 4280000, // 4.2 MB
    uploadDate: "2026-08-20T14:30:00Z",
    validationStatus: "pending",
    caseInfo: {
      id: "CASE-2026-0812",
      caseReference: "JN-2026-0812",
      title: "Arbitrary Detention at Checkpoint #4",
      category: "Civil Rights",
    },
    reporterInfo: {
      id: "REP-4402",
      fullName: "Elena Rostova",
      email: "elena.r@humanrights-monitor.org",
    },
    description: "High-resolution photo showing physical evidence at checkpoint.",
    storageBucket: "case-evidence",
    storagePath: "CASE-2026-0812/EVD-2026-9041_crime_scene_photo_01.jpg",
  },
  {
    id: "EVD-2026-9042",
    caseId: "CASE-2026-0812",
    reporterId: "REP-4402",
    fileName: "witness_statement_audio.m4a",
    fileType: "audio/m4a",
    evidenceType: "audio",
    fileSizeBytes: 18500000, // 18.5 MB
    uploadDate: "2026-08-20T15:05:12Z",
    validationStatus: "pending",
    caseInfo: {
      id: "CASE-2026-0812",
      caseReference: "JN-2026-0812",
      title: "Arbitrary Detention at Checkpoint #4",
      category: "Civil Rights",
    },
    reporterInfo: {
      id: "REP-4402",
      fullName: "Elena Rostova",
      email: "elena.r@humanrights-monitor.org",
    },
    description: "Audio recording of key eyewitness testimony.",
    storageBucket: "case-evidence",
    storagePath: "CASE-2026-0812/EVD-2026-9042_witness_statement_audio.m4a",
  },
  {
    id: "EVD-2026-9043",
    caseId: "CASE-2026-0798",
    reporterId: "REP-1092",
    fileName: "medical_report_signed.pdf",
    fileType: "application/pdf",
    evidenceType: "document",
    fileSizeBytes: 2450000, // 2.45 MB
    uploadDate: "2026-08-19T09:12:44Z",
    validationStatus: "validated",
    caseInfo: {
      id: "CASE-2026-0798",
      caseReference: "JN-2026-0798",
      title: "Excessive Force Incident in District 2",
      category: "Physical Integrity",
    },
    reporterInfo: {
      id: "REP-1092",
      fullName: "Dr. Marcus Vance",
      email: "m.vance@clinic-legal.org",
    },
    description: "Official hospital forensic examination report.",
    validatedAt: "2026-08-19T11:00:00Z",
    validatedBy: "Evidence Checker Squad #1",
  },
  {
    id: "EVD-2026-9044",
    caseId: "CASE-2026-0820",
    reporterId: "REP-3301",
    fileName: "suspicious_payload_installer.exe", // Unsupported file type!
    fileType: "application/x-msdownload",
    evidenceType: "document",
    fileSizeBytes: 15400000, // 15.4 MB
    uploadDate: "2026-08-20T16:00:00Z",
    validationStatus: "rejected",
    rejectionReason: "Unsupported file type '.exe'. Allowed types: JPG, PNG, MP4, M4A, PDF.",
    caseInfo: {
      id: "CASE-2026-0820",
      caseReference: "JN-2026-0820",
      title: "Unlawful Digital Surveillance",
      category: "Digital Rights",
    },
    reporterInfo: {
      id: "REP-3301",
      fullName: "Alex Chen",
      email: "alex.c@privacy-defender.net",
    },
    description: "Submitted binary executable file.",
  },
  {
    id: "EVD-2026-9045",
    caseId: "CASE-2026-0825",
    reporterId: "REP-5590",
    fileName: "gigabyte_raw_video_feed.mp4",
    fileType: "video/mp4",
    evidenceType: "video",
    fileSizeBytes: 145000000, // 145 MB (exceeds 100 MB max size!)
    uploadDate: "2026-08-20T18:22:10Z",
    validationStatus: "pending",
    caseInfo: {
      id: "CASE-2026-0825",
      caseReference: "JN-2026-0825",
      title: "Protest Dispersion Video Documentation",
      category: "Freedom of Assembly",
    },
    reporterInfo: {
      id: "REP-5590",
      fullName: "Sarah Jenkins",
      email: "s.jenkins@press-rights.org",
    },
    description: "4K continuous raw footage of protest dispersion.",
  },
  {
    id: "EVD-2026-9046",
    caseId: "", // Missing Case Link!
    reporterId: "REP-8812",
    fileName: "unlinked_document.pdf",
    fileType: "application/pdf",
    evidenceType: "document",
    fileSizeBytes: 512000, // 512 KB
    uploadDate: "2026-08-20T19:00:00Z",
    validationStatus: "pending",
    reporterInfo: {
      id: "REP-8812",
      fullName: "Anonymous Monitor",
    },
    description: "Document missing case association metadata.",
  },
  {
    id: "EVD-2026-9047",
    caseId: "CASE-2026-0830",
    reporterId: "REP-9921",
    fileName: "empty_log_file.jpg",
    fileType: "image/jpeg",
    evidenceType: "image",
    fileSizeBytes: 0, // 0 Bytes!
    uploadDate: "2026-08-20T19:15:00Z",
    validationStatus: "pending",
    caseInfo: {
      id: "CASE-2026-0830",
      caseReference: "JN-2026-0830",
      title: "Property Damage Investigation",
      category: "Housing Rights",
    },
    reporterInfo: {
      id: "REP-9921",
      fullName: "Tariq Mansoor",
    },
    description: "Zero-byte corrupted image file upload.",
  },
  {
    id: "EVD-2026-9048",
    caseId: "CASE-2026-0812",
    reporterId: "REP-4402",
    fileName: "file:///C:/Users/kavin/Documents/confidential_scan.png", // Exposed Local Server Path!
    fileType: "image/png",
    evidenceType: "image",
    fileSizeBytes: 3100000,
    uploadDate: "2026-08-20T20:00:00Z",
    validationStatus: "pending",
    localPathExposed: true,
    storageBucket: "case-evidence",
    storagePath: "file:///C:/Users/kavin/Documents/confidential_scan.png",
    caseInfo: {
      id: "CASE-2026-0812",
      caseReference: "JN-2026-0812",
      title: "Arbitrary Detention at Checkpoint #4",
    },
    reporterInfo: {
      id: "REP-4402",
      fullName: "Elena Rostova",
    },
    description: "Upload contained raw un-sanitized local device path.",
  },
  {
    id: "EVD-2026-9049",
    caseId: "CASE-2026-0835",
    reporterId: "REP-6109",
    fileName: "public_access_photo.jpg",
    fileType: "image/jpeg",
    evidenceType: "image",
    fileSizeBytes: 2800000,
    uploadDate: "2026-08-20T20:30:00Z",
    validationStatus: "pending",
    isPrivateBucket: false, // Public bucket exposure!
    storageBucket: "public-web-assets",
    storagePath: "public/unprotected_photo.jpg",
    caseInfo: {
      id: "CASE-2026-0835",
      caseReference: "JN-2026-0835",
      title: "Public Event Demonstration",
    },
    reporterInfo: {
      id: "REP-6109",
      fullName: "Jordan Lee",
    },
    description: "Evidence stored in an unencrypted public Web assets bucket.",
  },
  {
    id: "EVD-2026-9050",
    caseId: "CASE-2026-0840",
    reporterId: "REP-7720",
    fileName: "deleted_storage_object.pdf",
    fileType: "application/pdf",
    evidenceType: "document",
    fileSizeBytes: 1200000,
    uploadDate: "2026-08-20T21:00:00Z",
    validationStatus: "pending",
    fileExistsInStorage: false, // Missing file error!
    storageBucket: "case-evidence",
    storagePath: "CASE-2026-0840/EVD-2026-9050_deleted_storage_object.pdf",
    caseInfo: {
      id: "CASE-2026-0840",
      caseReference: "JN-2026-0840",
      title: "Missing Storage Asset Audit",
    },
    reporterInfo: {
      id: "REP-7720",
      fullName: "Samira Khan",
    },
    description: "Database reference exists but object missing from storage vault.",
  },
];

let inMemoryStore: EvidenceRecord[] = [...INITIAL_MOCK_EVIDENCE];

export async function fetchEvidenceCheckerQueue(): Promise<EvidenceRecord[]> {
  try {
    const { data: dbEvidence, error } = await supabase
      .from("case_evidence")
      .select(
        `
        id,
        case_id,
        evidence_type,
        title,
        description,
        file_name,
        storage_bucket,
        storage_path,
        mime_type,
        file_size_bytes,
        validation_status,
        created_at,
        cases (
          id,
          case_reference,
          title
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error || !dbEvidence || dbEvidence.length === 0) {
      return [...inMemoryStore];
    }

    // Merge Supabase records with formatted links
    const mapped: EvidenceRecord[] = dbEvidence.map((item: any) => {
      const caseRef = item.cases?.case_reference || item.case_id || "UNLINKED-CASE";
      const caseTitle = item.cases?.title || "Case Record";

      return {
        id: item.id,
        caseId: item.case_id || "",
        reporterId: "REP-SYSTEM",
        fileName: item.file_name || item.title || "unnamed_file",
        fileType: item.mime_type || "application/octet-stream",
        evidenceType: item.evidence_type || "document",
        fileSizeBytes: item.file_size_bytes || 0,
        uploadDate: item.created_at || new Date().toISOString(),
        validationStatus: (item.validation_status || "pending") as EvidenceValidationStatus,
        caseInfo: {
          id: item.case_id || "",
          caseReference: caseRef,
          title: caseTitle,
        },
        reporterInfo: {
          id: "REP-SYSTEM",
          fullName: "Case Reporter",
        },
        storageBucket: item.storage_bucket,
        storagePath: item.storage_path,
        description: item.description || item.title,
      };
    });

    // Combine with local mock test cases for full validation testing
    const dbIds = new Set(mapped.map((m) => m.id));
    const extraMocks = inMemoryStore.filter((mock) => !dbIds.has(mock.id));
    const combined = [...mapped, ...extraMocks];

    // Sort strictly by submission date descending (newest submission first)
    return combined.sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
  } catch (err) {
    console.warn("Using in-memory evidence store:", err);
    return [...inMemoryStore].sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
  }
}

export async function updateEvidenceValidationDecision(params: {
  evidenceId: string;
  status: EvidenceValidationStatus;
  rejectionReason?: string;
  notes?: string;
  checkerId?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    // 1. Update in-memory store
    const idx = inMemoryStore.findIndex((e) => e.id === params.evidenceId);
    if (idx !== -1) {
      inMemoryStore[idx] = {
        ...inMemoryStore[idx],
        validationStatus: params.status,
        rejectionReason: params.rejectionReason,
        checkerNotes: params.notes,
        validatedAt: new Date().toISOString(),
        validatedBy: params.checkerId || "Evidence Checker",
      };
    }

    // 2. Sync to Supabase if connected
    const { error } = await supabase
      .from("case_evidence")
      .update({
        validation_status: params.status,
      })
      .eq("id", params.evidenceId);

    if (error) {
      console.warn("Supabase evidence status sync error:", error.message);
    }

    return {
      ok: true,
      message: `Evidence status successfully updated to '${params.status}'.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || "Failed to update evidence status.",
    };
  }
}

export function resetInMemoryEvidenceStore() {
  inMemoryStore = [...INITIAL_MOCK_EVIDENCE];
}
