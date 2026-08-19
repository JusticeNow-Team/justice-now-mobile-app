import {
  ACTIVE_STATUSES,
  CaseListTab,
  ReporterCase,
  ReporterCaseStatus,
  RESOLVED_STATUSES,
  WAITING_STATUSES,
} from "./types";

export function filterReporterCases(
  cases: ReporterCase[],
  options: {
    tab: CaseListTab;
    status: "all" | ReporterCaseStatus;
    query: string;
  }
) {
  const query = options.query.trim().toLowerCase();

  return cases.filter((item) => {
    if (options.tab === "active" && !ACTIVE_STATUSES.includes(item.status)) {
      return false;
    }

    if (options.tab === "waiting" && !WAITING_STATUSES.includes(item.status)) {
      return false;
    }

    if (options.tab === "resolved" && !RESOLVED_STATUSES.includes(item.status)) {
      return false;
    }

    if (options.status !== "all" && item.status !== options.status) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      item.caseReference.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });
}

export function formatCaseDate(value: string | null) {
  if (!value) {
    return "Date not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatCaseDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
