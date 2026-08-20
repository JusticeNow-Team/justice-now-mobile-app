import { supabase } from "../../lib/supabase";
import { incidentCategories } from "./options";
import { CaseDraft } from "./types";

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
    }`,
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
        }`,
      );
    });
  }

  lines.push(
    `Hide identity from selected parties: ${draft.hideIdentity ? "Yes" : "No"}`,
  );

  lines.push(`Investigator may contact: ${draft.allowContact ? "Yes" : "No"}`);

  lines.push(
    `Discreet notifications: ${draft.discreetNotifications ? "Yes" : "No"}`,
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
  | {
      ok: false;
      reason: "unauthenticated" | "generic";
      message: string;
    };

export async function submitReporterCase(
  draft: CaseDraft,
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
      message: "Only a signed-in Reporter can submit a case.",
    };
  }

  const { data, error } = await supabase.rpc("submit_reporter_case", {
    p_title: draft.title.trim(),
    p_description: buildDescription(draft),
    p_category: categoryLabels(draft.categories),
    p_incident_date: draft.incidentDate.trim(),
    p_district: draft.district,
    p_is_anonymous: draft.reportingMode === "anonymous",
  });

  const submittedCase = Array.isArray(data) ? data[0] : data;

  if (error || !submittedCase) {
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
    id: submittedCase.id,
    caseReference: submittedCase.case_reference,
    submittedAt: submittedCase.created_at,
  };
}
