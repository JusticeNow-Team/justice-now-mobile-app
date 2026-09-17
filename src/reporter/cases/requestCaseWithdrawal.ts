import { supabase } from "../../lib/supabase";
import { ReporterCaseStatus } from "./types";

const BLOCKED_STATUSES: ReporterCaseStatus[] = [
  "resolved",
  "closed",
  "withdrawal_requested",
];

export type RequestCaseWithdrawalResult =
  | {
      ok: true;
      requestedAt: string;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "validation" | "generic";
      message: string;
    };

function mapStorageError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("schema cache")
  ) {
    return "Withdrawal requests are not available on the server yet. Please try again later.";
  }

  if (lower.includes("check") || lower.includes("enum") || lower.includes("invalid")) {
    return "This case status cannot be set to withdrawal requested yet. Please contact support.";
  }

  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "A withdrawal request is already recorded for this case.";
  }

  return message || "JusticeNow could not submit your withdrawal request.";
}

export function canRequestWithdrawal(status: ReporterCaseStatus) {
  return !BLOCKED_STATUSES.includes(status);
}

export async function requestCaseWithdrawal(input: {
  caseId: string;
  reason: string;
}): Promise<RequestCaseWithdrawalResult> {
  const reason = input.reason.trim();

  if (reason.length < 10) {
    return {
      ok: false,
      reason: "validation",
      message: "Please explain why you want to withdraw this case (at least 10 characters).",
    };
  }

  if (reason.length > 1000) {
    return {
      ok: false,
      reason: "validation",
      message: "Keep your withdrawal reason within 1000 characters.",
    };
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to request a withdrawal.",
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
      message: "Only a signed-in reporter can request case withdrawal.",
    };
  }

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id, status, reporter_id")
    .eq("id", input.caseId)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (!caseRow) {
    return {
      ok: false,
      reason: "forbidden",
      message: "This case does not belong to your account.",
    };
  }

  if (!canRequestWithdrawal(caseRow.status as ReporterCaseStatus)) {
    return {
      ok: false,
      reason: "forbidden",
      message:
        caseRow.status === "withdrawal_requested"
          ? "A withdrawal request is already pending for this case."
          : "Resolved or closed cases cannot be withdrawn.",
    };
  }

  const requestedAt = new Date().toISOString();

  const { data: existing } = await supabase
    .from("case_withdrawal_requests")
    .select("id, status")
    .eq("case_id", input.caseId)
    .eq("reporter_id", user.id)
    .in("status", ["requested", "pending"])
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      reason: "forbidden",
      message: "A withdrawal request is already pending for this case.",
    };
  }

  const { error: insertError } = await supabase
    .from("case_withdrawal_requests")
    .insert({
      case_id: input.caseId,
      reporter_id: user.id,
      reason,
      status: "requested",
      requested_at: requestedAt,
    });

  if (insertError) {
    return {
      ok: false,
      reason: "generic",
      message: mapStorageError(insertError.message),
    };
  }

  const previousStatus = caseRow.status;

  const { error: statusError } = await supabase
    .from("cases")
    .update({
      status: "withdrawal_requested",
      updated_at: requestedAt,
    })
    .eq("id", input.caseId)
    .eq("reporter_id", user.id);

  if (statusError) {
    return {
      ok: false,
      reason: "generic",
      message: mapStorageError(statusError.message),
    };
  }

  await supabase.from("case_status_history").insert({
    case_id: input.caseId,
    old_status: previousStatus,
    new_status: "withdrawal_requested",
    changed_at: requestedAt,
  });

  return {
    ok: true,
    requestedAt,
  };
}
