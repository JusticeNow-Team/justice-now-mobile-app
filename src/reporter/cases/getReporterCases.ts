import { supabase } from "../../lib/supabase";
import { ReporterCase, ReporterCaseStatus } from "./types";

export type GetReporterCasesResult =
  | { ok: true; cases: ReporterCase[] }
  | {
      ok: false;
      reason: "unauthenticated" | "generic";
      message: string;
    };

const STATUSES: ReporterCaseStatus[] = [
  "submitted",
  "under_review",
  "assigned",
  "investigating",
  "awaiting_evidence",
  "resolved",
  "closed",
];

function asStatus(value: string): ReporterCaseStatus {
  return STATUSES.includes(value as ReporterCaseStatus)
    ? (value as ReporterCaseStatus)
    : "submitted";
}

export async function getReporterCases(): Promise<GetReporterCasesResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to view your cases.",
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
      ok: false,
      reason: "unauthenticated",
      message: "This area is only available to reporter accounts.",
    };
  }

  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, case_reference, title, category, incident_date, status, created_at, updated_at, reporter_id"
    )
    .eq("reporter_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      reason: "generic",
      message: error.message || "JusticeNow could not load your cases.",
    };
  }

  const cases: ReporterCase[] = (data ?? [])
    .filter((row) => row.reporter_id === user.id)
    .map((row) => ({
      id: row.id,
      caseReference: row.case_reference,
      title: row.title,
      category: row.category,
      incidentDate: row.incident_date,
      status: asStatus(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

  return { ok: true, cases };
}
