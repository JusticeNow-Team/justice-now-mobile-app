import { hasPermission } from "../auth/permissions";
import { SystemRole } from "../auth/types";
import { EvidenceRecord } from "./types";

export type EvidenceStatusFilter =
  | "all"
  | "pending"
  | "under_review"
  | "validated"
  | "rejected"
  | "info_requested"
  | "archived"
  | "completed";

export type EvidenceTypeFilter =
  | "all"
  | "image"
  | "video"
  | "audio"
  | "document";

export interface EvidenceFilterOptions {
  searchQuery?: string;
  statusFilter?: EvidenceStatusFilter;
  evidenceTypeFilter?: EvidenceTypeFilter;
  assignedCheckerFilter?: string; // "all", "unassigned", "my_assigned", or specific checker ID
  userRole?: SystemRole | string | null;
  userId?: string;
  userName?: string;
}

export interface FilterResult {
  records: EvidenceRecord[];
  totalCount: number;
  filteredCount: number;
  isAuthorizedToFilterCheckers: boolean;
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

export const DEFAULT_FILTER_OPTIONS: EvidenceFilterOptions = {
  searchQuery: "",
  statusFilter: "all",
  evidenceTypeFilter: "all",
  assignedCheckerFilter: "all",
};

/**
 * Checks if the given user role is authorized to filter evidence across all assigned checkers.
 * System Admins, Case Officers, and Evidence Checkers with evidence:read:all permission are authorized.
 */
export function isUserAuthorizedToFilterCheckers(role?: SystemRole | string | null): boolean {
  if (!role) return true; // Default to true in offline/demo mode if unauthenticated
  const normRole = role.toLowerCase().trim();
  if (normRole === "system_admin" || normRole === "case_officer") {
    return true;
  }
  return hasPermission(normRole, "evidence:read:all");
}

/**
 * Core search and multi-filter service for evidence records.
 * Supports:
 * - JN-231: Search by case reference, evidence ID, file name, reporter, or description.
 * - JN-232: Filter by evidence status.
 * - JN-233: Filter by evidence file type (photo/image, video, audio, document).
 * - JN-234: Filter by assigned checker (when authorized).
 * - Respects user permissions by constraining results where restricted.
 * - Provides active filter counting & reset capabilities.
 */
export function filterEvidenceRecords(
  allRecords: EvidenceRecord[],
  options: EvidenceFilterOptions = {}
): FilterResult {
  const {
    searchQuery = "",
    statusFilter = "all",
    evidenceTypeFilter = "all",
    assignedCheckerFilter = "all",
    userRole = null,
    userId = undefined,
    userName = undefined,
  } = options;

  const isAuthorized = isUserAuthorizedToFilterCheckers(userRole);

  // Permission check: if restricted (unauthorized for full view), filter pool to assigned to user or unassigned
  let candidateRecords = [...allRecords];
  if (!isAuthorized && userId) {
    candidateRecords = candidateRecords.filter(
      (r) => !r.assignedCheckerId || r.assignedCheckerId === userId
    );
  }

  let activeFilterCount = 0;

  if (searchQuery.trim().length > 0) activeFilterCount++;
  if (statusFilter !== "all") activeFilterCount++;
  if (evidenceTypeFilter !== "all") activeFilterCount++;
  if (assignedCheckerFilter !== "all") activeFilterCount++;

  const filtered = candidateRecords.filter((record) => {
    // JN-231: Search by case reference, ID, title, file name, reporter, description
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const caseRef = (record.caseInfo?.caseReference || "").toLowerCase();
      const caseId = (record.caseId || "").toLowerCase();
      const caseTitle = (record.caseInfo?.title || "").toLowerCase();
      const evidenceId = (record.id || "").toLowerCase();
      const fileName = (record.fileName || "").toLowerCase();
      const reporterName = (record.reporterInfo?.fullName || "").toLowerCase();
      const reporterId = (record.reporterId || "").toLowerCase();
      const description = (record.description || "").toLowerCase();

      const matchesSearch =
        caseRef.includes(q) ||
        caseId.includes(q) ||
        caseTitle.includes(q) ||
        evidenceId.includes(q) ||
        fileName.includes(q) ||
        reporterName.includes(q) ||
        reporterId.includes(q) ||
        description.includes(q);

      if (!matchesSearch) return false;
    }

    // JN-232: Filter by evidence status
    if (statusFilter !== "all") {
      const status = record.validationStatus;
      if (statusFilter === "pending" && status !== "pending") return false;
      if (statusFilter === "under_review" && status !== "under_review") return false;
      if (statusFilter === "validated" && status !== "validated" && status !== "approved") return false;
      if (statusFilter === "rejected" && status !== "rejected") return false;
      if (statusFilter === "info_requested" && status !== "info_requested") return false;
      if (statusFilter === "archived" && status !== "archived") return false;
      if (
        statusFilter === "completed" &&
        status !== "validated" &&
        status !== "approved" &&
        status !== "rejected" &&
        status !== "archived"
      ) {
        return false;
      }
    }

    // JN-233: Filter by evidence file type
    if (evidenceTypeFilter !== "all") {
      const type = (record.evidenceType || "").toLowerCase();
      const mime = (record.fileType || "").toLowerCase();

      if (evidenceTypeFilter === "image") {
        if (type !== "image" && !mime.startsWith("image/")) return false;
      } else if (evidenceTypeFilter === "video") {
        if (type !== "video" && !mime.startsWith("video/")) return false;
      } else if (evidenceTypeFilter === "audio") {
        if (type !== "audio" && !mime.startsWith("audio/")) return false;
      } else if (evidenceTypeFilter === "document") {
        if (
          type !== "document" &&
          !mime.startsWith("application/") &&
          !mime.includes("pdf") &&
          !mime.includes("document")
        ) {
          return false;
        }
      }
    }

    // JN-234: Filter by assigned checker (where authorized)
    if (assignedCheckerFilter !== "all" && isAuthorized) {
      if (assignedCheckerFilter === "unassigned") {
        if (record.assignedCheckerId && record.assignedCheckerId.trim().length > 0) {
          return false;
        }
      } else if (assignedCheckerFilter === "my_assigned") {
        if (userId && record.assignedCheckerId !== userId) {
          return false;
        }
        if (!userId && userName && record.assignedByName !== userName) {
          return false;
        }
      } else {
        // Specific checker ID matching
        if (
          record.assignedCheckerId !== assignedCheckerFilter &&
          record.assignedByName !== assignedCheckerFilter
        ) {
          return false;
        }
      }
    }

    return true;
  });

  return {
    records: filtered,
    totalCount: allRecords.length,
    filteredCount: filtered.length,
    isAuthorizedToFilterCheckers: isAuthorized,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
  };
}

/**
 * Resets all filter options back to their clean default state.
 */
export function resetFilters(): EvidenceFilterOptions {
  return { ...DEFAULT_FILTER_OPTIONS };
}
