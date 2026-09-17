import { supabase } from "../../lib/supabase";

export type SubmitInformationResponseResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "validation" | "generic";
      message: string;
    };

export async function submitInformationResponse(input: {
  requestId: string;
  caseId: string;
  requestedItems: string[];
  responseText: string;
}): Promise<SubmitInformationResponseResult> {
  const responseText = input.responseText.trim();

  if (!responseText) {
    return {
      ok: false,
      reason: "validation",
      message: "Write your response before submitting.",
    };
  }

  if (responseText.length > 2000) {
    return {
      ok: false,
      reason: "validation",
      message: "Keep your response within 2000 characters.",
    };
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (sessionError || !sessionData.user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to submit your response.",
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
      message: "Only a signed-in reporter can respond to information requests.",
    };
  }

  const { data: requestRow } = await supabase
    .from("case_information_requests")
    .select("id, status")
    .eq("id", input.requestId)
    .eq("case_id", input.caseId)
    .eq("reporter_id", user.id)
    .eq("status", "sent")
    .maybeSingle();

  if (!requestRow) {
    return {
      ok: false,
      reason: "forbidden",
      message: "This information request is not open for a response.",
    };
  }

  const answers = input.requestedItems.map((question) => ({
    question,
    answer: responseText,
  }));

  const submittedAt = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("case_information_responses")
    .insert({
      request_id: input.requestId,
      case_id: input.caseId,
      reporter_id: user.id,
      answers,
      additional_message: responseText,
      submitted_at: submittedAt,
    });

  if (insertError) {
    return {
      ok: false,
      reason: "generic",
      message:
        insertError.message ||
        "JusticeNow could not submit your response. Please try again.",
    };
  }

  const { error: updateError } = await supabase
    .from("case_information_requests")
    .update({
      status: "responded",
      responded_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq("id", input.requestId)
    .eq("reporter_id", user.id)
    .eq("status", "sent");

  if (updateError) {
    return {
      ok: false,
      reason: "generic",
      message:
        updateError.message ||
        "Your response was saved, but the request status could not be updated. Please contact support if this persists.",
    };
  }

  return { ok: true };
}
