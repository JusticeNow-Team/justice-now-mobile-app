import { supabase } from "../lib/supabase";

export type CaseMessage = {
  id: string;
  caseId: string;
  senderId: string | null;
  senderRole: "reporter" | "case_officer" | "system_admin";
  body: string;
  reporterVisible: boolean;
  createdAt: string;
  readAt: string | null;
};

type CaseMessageRow = {
  id: string;
  case_id: string;
  sender_id: string | null;
  sender_role: "reporter" | "case_officer" | "system_admin";
  body: string;
  reporter_visible: boolean;
  created_at: string;
  read_at: string | null;
};

export type CaseMessageResult =
  | { ok: true; messages: CaseMessage[] }
  | { ok: false; message: string };

function mapMessage(row: CaseMessageRow): CaseMessage {
  return {
    id: row.id,
    caseId: row.case_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    reporterVisible: row.reporter_visible,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function getCaseMessages(
  caseId: string,
): Promise<CaseMessageResult> {
  const { data, error } = await supabase.rpc("get_my_case_messages", {
    p_case_id: caseId,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message ||
        "JusticeNow could not load secure case messages.",
    };
  }

  return {
    ok: true,
    messages: ((data ?? []) as CaseMessageRow[]).map(mapMessage),
  };
}

export async function sendCaseMessage(input: {
  caseId: string;
  body: string;
  reporterVisible?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const body = input.body.trim();

  if (body.length === 0) {
    return { ok: false, message: "Write a message before sending." };
  }

  if (body.length > 2000) {
    return { ok: false, message: "Keep messages within 2000 characters." };
  }

  const { data, error } = await supabase.rpc("send_case_message", {
    p_case_id: input.caseId,
    p_body: body,
    p_reporter_visible: input.reporterVisible ?? true,
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ||
        "JusticeNow could not send this secure case message.",
    };
  }

  return { ok: true, id: String(data) };
}
