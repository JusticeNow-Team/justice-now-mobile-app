import { EvidenceStatus, PublicStatusInfo, StatusHistoryRecord, EvidenceRecord } from "./types";

/**
 * JN-172: State Machine Mapping for Evidence Status Transitions
 * Defines allowed destination statuses for each current status.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<EvidenceStatus, EvidenceStatus[]> = {
  pending: ["under_review", "validated", "rejected", "info_requested"],
  under_review: ["validated", "rejected", "info_requested", "pending"],
  info_requested: ["under_review", "pending", "rejected", "validated"],
  validated: ["under_review", "archived"],
  rejected: ["under_review"], // Re-examination / Appeal
  archived: [], // Terminal archived state
};

export interface TransitionValidationResult {
  isValid: boolean;
  message: string;
  fromStatus: EvidenceStatus;
  toStatus: EvidenceStatus;
}

/**
 * JN-172: Validates if an evidence status transition is allowed by system rules.
 */
export function validateStatusTransition(
  fromStatus: EvidenceStatus,
  toStatus: EvidenceStatus
): TransitionValidationResult {
  if (fromStatus === toStatus) {
    return {
      isValid: false,
      message: `Evidence is already in '${fromStatus}' status.`,
      fromStatus,
      toStatus,
    };
  }

  const allowedNextStates = ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
  const isValid = allowedNextStates.includes(toStatus);

  if (!isValid) {
    return {
      isValid: false,
      message: `Invalid Status Transition: Cannot change evidence status from '${fromStatus}' directly to '${toStatus}'. Allowed next states are: [${allowedNextStates.join(
        ", "
      )}].`,
      fromStatus,
      toStatus,
    };
  }

  return {
    isValid: true,
    message: `Valid status transition from '${fromStatus}' to '${toStatus}'.`,
    fromStatus,
    toStatus,
  };
}

/**
 * JN-173 & JN-175: Helper to construct a new status change history record.
 */
export function createStatusHistoryEntry({
  evidenceId,
  fromStatus,
  toStatus,
  changedByRole,
  changedById,
  changedByName,
  notes,
  rejectionReason,
}: {
  evidenceId: string;
  fromStatus: EvidenceStatus;
  toStatus: EvidenceStatus;
  changedByRole: "checker" | "case_officer" | "system" | "reporter";
  changedById?: string;
  changedByName?: string;
  notes?: string;
  rejectionReason?: string;
}): StatusHistoryRecord {
  return {
    id: `HIST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    evidenceId,
    fromStatus,
    toStatus,
    changedAt: new Date().toISOString(),
    changedByRole,
    changedById: changedById || "checker-squad-1",
    changedByName: changedByName || "Evidence Checker",
    notes: notes || `Status changed from ${fromStatus} to ${toStatus}.`,
    rejectionReason: rejectionReason,
  };
}

/**
 * JN-174 & JN-176: Reporter View Status Sanitation
 * Maps internal technical evidence status to privacy-sanitized public info.
 */
export function getPublicStatusForReporter(status: EvidenceStatus): PublicStatusInfo {
  switch (status) {
    case "pending":
      return {
        publicLabel: "Received - Awaiting Verification",
        publicDescription:
          "Your evidence submission has been securely received by the system and is queued for verification by an evidence checker.",
        badgeBg: "#FEF3C7",
        badgeFg: "#92400E",
        actionRequiredForReporter: false,
      };

    case "under_review":
      return {
        publicLabel: "Under Verification",
        publicDescription:
          "An evidence checker is currently reviewing file integrity, metadata compliance, and case linkage.",
        badgeBg: "#E0F2FE",
        badgeFg: "#0369A1",
        actionRequiredForReporter: false,
      };

    case "validated":
      return {
        publicLabel: "Verified & Attached to Case",
        publicDescription:
          "Your evidence has passed all verification checks and has been securely attached to the investigation file.",
        badgeBg: "#D1FAE5",
        badgeFg: "#065F46",
        actionRequiredForReporter: false,
      };

    case "info_requested":
      return {
        publicLabel: "Action Required: Additional Information Requested",
        publicDescription:
          "The evidence checker has requested additional metadata or context regarding your submission.",
        badgeBg: "#FEF9C3",
        badgeFg: "#854D0E",
        actionRequiredForReporter: true,
      };

    case "rejected":
      return {
        publicLabel: "Review Completed - Not Accepted",
        publicDescription:
          "The submitted evidence record could not be validated due to formatting, corrupt data, or metadata requirements.",
        badgeBg: "#FEE2E2",
        badgeFg: "#991B1B",
        actionRequiredForReporter: false,
      };

    case "archived":
      return {
        publicLabel: "Case Archived",
        publicDescription:
          "The linked investigation case has been closed or archived.",
        badgeBg: "#F1F5F9",
        badgeFg: "#475569",
        actionRequiredForReporter: false,
      };

    default:
      return {
        publicLabel: "Processing Submission",
        publicDescription: "Your submission is being processed.",
        badgeBg: "#F1F5F9",
        badgeFg: "#475569",
        actionRequiredForReporter: false,
      };
  }
}

/**
 * JN-174: Case Officer View Status Information
 * Provides full technical status overview for Case Officers & Investigators.
 */
export function getCaseOfficerStatusView(record: EvidenceRecord) {
  const publicInfo = getPublicStatusForReporter(record.validationStatus);
  const historyCount = record.statusHistory?.length || 0;
  const isChainOfCustodyActive = record.validationStatus === "validated";

  return {
    evidenceId: record.id,
    caseReference: record.caseInfo?.caseReference || record.caseId,
    currentStatus: record.validationStatus,
    lastStatusChange: record.lastStatusChangedAt || record.uploadDate,
    historyCount,
    isChainOfCustodyActive,
    publicReporterSummary: publicInfo.publicLabel,
    checkerNotes: record.checkerNotes || "No notes recorded.",
    rejectionReason: record.rejectionReason || null,
    storageSecurity: {
      bucket: record.storageBucket || "case-evidence",
      isPrivate: record.isPrivateBucket !== false,
      hasCollisionProofSlug: true,
    },
  };
}
