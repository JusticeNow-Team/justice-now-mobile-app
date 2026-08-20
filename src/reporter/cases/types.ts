export type ReporterCaseStatus =
  | "submitted"
  | "under_review"
  | "assigned"
  | "investigating"
  | "awaiting_information"
  | "awaiting_evidence"
  | "resolved"
  | "closed";

export interface ReporterCase {
  id: string;
  caseReference: string;
  title: string;
  category: string;
  incidentDate: string | null;
  status: ReporterCaseStatus;
  createdAt: string;
  updatedAt: string;
}

export type CaseListTab =
  | "all"
  | "active"
  | "waiting"
  | "resolved";

export const ACTIVE_STATUSES: ReporterCaseStatus[] = [
  "submitted",
  "under_review",
  "assigned",
  "investigating",
];

export const WAITING_STATUSES: ReporterCaseStatus[] = [
  "awaiting_information",
  "awaiting_evidence",
];

export const RESOLVED_STATUSES: ReporterCaseStatus[] = [
  "resolved",
  "closed",
];

export const STATUS_FILTERS: {
  value: "all" | ReporterCaseStatus;
  label: string;
}[] = [
  {
    value: "all",
    label: "Status: All",
  },
  {
    value: "submitted",
    label: "Submitted",
  },
  {
    value: "under_review",
    label: "Under review",
  },
  {
    value: "assigned",
    label: "Assigned",
  },
  {
    value: "investigating",
    label: "Investigating",
  },
  {
    value: "awaiting_information",
    label: "Awaiting information",
  },
  {
    value: "awaiting_evidence",
    label: "Awaiting evidence",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
  {
    value: "closed",
    label: "Closed",
  },
];