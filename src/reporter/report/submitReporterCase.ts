import { supabase } from "../../lib/supabase";
import { incidentCategories } from "./options";
import { CaseDraft } from "./types";

function generateCaseReference() {
  const year = new Date().getFullYear();
  const serial = `${Math.floor(10000 + Math.random() * 90000)}`;
  return `JN-${year}-${serial}`;
}

function categoryLabels(ids: string[]) {
  return ids
    .map((id) => incidentCategories.find((item) => item.id === id)?.label ?? id)
    .join("; ");
}

function buildDescription(draft: CaseDraft) {
  const lines = [draft.description.trim(), "", "--- Additional details ---"];

  if (draft.incidentTime.trim()) {
    lines.push(`Approximate time: ${draft.incidentTime.trim()}`);
  }

  lines.push(`Still ongoing: ${draft.ongoing || "Not specified"}`);
  lines.push(`Province: ${draft.province}`);
  lines.push(`District: ${draft.district}`);

  if (draft.city.trim()) {
    lines.push(`City or area: ${draft.city.trim()}`);
  }

  if (!draft.hideExactLocation && draft.specificLocation.trim()) {
    lines.push(`Specific location: ${draft.specificLocation.trim()}`);
  } else if (draft.hideExactLocation) {
    lines.push("Exact location: withheld");
  }

  lines.push(
    `Reporting as: ${
      draft.victimRelation === "self"
        ? "The affected person"
        : "For another person"
    }`
  );

  if (draft.victimName.trim()) {
    lines.push(`Affected person name: ${draft.victimName.trim()}`);
  }

  if (draft.victimAge) {
    lines.push(`Approximate age: ${draft.victimAge}`);
  }

  if (draft.victimGender) {
    lines.push(`Gender: ${draft.victimGender}`);
  }

  if (draft.victimContact.trim()) {
    lines.push(`Affected person contact: ${draft.victimContact.trim()}`);
  }

  if (draft.victimRelationship.trim()) {
    lines.push(`Relationship: ${draft.victimRelationship.trim()}`);
  }

  if (draft.witnesses.length > 0) {
    lines.push(`Witnesses: ${draft.witnesses.length}`);
    draft.witnesses.forEach((witness, index) => {
      lines.push(
        `Witness ${index + 1}: ${witness.name || "Name withheld"} · ${
          witness.seen || "No description"
        }`
      );
    });
  }

  lines.push(
    `Hide identity from selected parties: ${draft.hideIdentity ? "Yes" : "No"}`
  );
  lines.push(`Investigator may contact: ${draft.allowContact ? "Yes" : "No"}`);
  lines.push(
    `Discreet notifications: ${draft.discreetNotifications ? "Yes" : "No"}`
  );
  lines.push(`Preferred contact: ${draft.contactMethod}`);

  return lines.join("\n");
}

export type SubmitCaseResult =
  | {
      ok: true;
      id: string;
      caseReference: string;
      submittedAt: string;
    }
  | { ok: false; reason: "unauthenticated" | "generic"; message: string };

export async function submitReporterCase(
  draft: CaseDraft
): Promise<SubmitCaseResult> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to submit a case.",
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
      message: "Only a signed-in reporter can submit a case.",
    };
  }

  const payload = {
    reporter_id: user.id,
    case_reference: generateCaseReference(),
    title: draft.title.trim(),
    description: buildDescription(draft),
    category: categoryLabels(draft.categories),
    incident_date: draft.incidentDate.trim(),
    district: draft.district,
    status: "submitted",
    priority: "medium",
    is_anonymous: draft.reportingMode === "anonymous",
  };

  let { data, error } = await supabase
    .from("cases")
    .insert(payload)
    .select("id, case_reference, created_at")
    .single();

  if (error && /reporter_id/i.test(error.message)) {
    const withoutReporter = { ...payload };
    delete (withoutReporter as { reporter_id?: string }).reporter_id;
    const retry = await supabase
      .from("cases")
      .insert(withoutReporter)
      .select("id, case_reference, created_at")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error && /duplicate|unique/i.test(error.message)) {
    const retry = await supabase
      .from("cases")
      .insert({ ...payload, case_reference: generateCaseReference() })
      .select("id, case_reference, created_at")
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return {
      ok: false,
      reason: "generic",
      message:
        error?.message ||
        "JusticeNow could not save your case. Please try again.",
    };
  }

  return {
    ok: true,
    id: data.id,
    caseReference: data.case_reference,
    submittedAt: data.created_at,
  };
}
