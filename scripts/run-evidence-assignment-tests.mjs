import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("./seeds/006_evidence_assignment.sql", import.meta.url),
  "utf8",
);
const officerScreen = await readFile(
  new URL("../src/app/officer/assign-evidence.tsx", import.meta.url),
  "utf8",
);
const officerEvidenceScreen = await readFile(
  new URL("../src/app/officer/evidence.tsx", import.meta.url),
  "utf8",
);
const validatorApi = await readFile(
  new URL("../src/evidence-validator/api.ts", import.meta.url),
  "utf8",
);

const requirements = [
  [
    "one active assignment per evidence item",
    /create unique index[\s\S]*evidence_id[\s\S]*where status in \('assigned', 'under_review'\)/i,
  ],
  [
    "existing Evidence Checker column compatibility",
    /evidence_checker_id uuid not null references public\.profiles\(id\)/,
  ],
  [
    "non-destructive timeline visibility upgrade",
    /alter table public\.case_timeline_events[\s\S]*add column if not exists reporter_visible/,
  ],
  [
    "pending evidence enforcement",
    /evidence\.validation_status::text = 'pending'/,
  ],
  [
    "active Evidence Validator enforcement",
    /checker\.role::text = 'evidence_validator'[\s\S]*checker\.is_active = true/,
  ],
  [
    "active Case Officer ownership enforcement",
    /officer_assignment\.assigned_officer_id = v_officer_id[\s\S]*officer_assignment\.is_active = true/,
  ],
  ["MFA enforcement", /auth\.jwt\(\) ->> 'aal'/],
  ["assignment timeline entry", /'evidence_assigned'/],
  ["Validator queue RPC", /create function public\.get_my_evidence_assignments\(\)/],
  ["start-review RPC", /create function public\.start_my_evidence_review\(p_assignment_id uuid\)/],
  [
    "verification decision storage",
    /create table if not exists public\.evidence_verification_decisions/,
  ],
  [
    "checker decision RPC",
    /create function public\.submit_evidence_verification_decision\(/,
  ],
  [
    "officer result RPC",
    /create function public\.get_officer_evidence_verification_results\(/,
  ],
  [
    "verification result officer ownership",
    /officer_assignment\.assigned_officer_id = v_officer_id[\s\S]*officer_assignment\.is_active = true[\s\S]*decision_record\.case_id/,
  ],
  [
    "separate reporter-visible timeline entry",
    /'evidence_update_available'[\s\S]*v_reporter_message[\s\S]*true/,
  ],
  [
    "case action storage after evidence review",
    /create table if not exists public\.evidence_case_actions/,
  ],
  [
    "one case action per verification result",
    /create unique index[\s\S]*evidence_case_actions_one_per_decision[\s\S]*decision_id/i,
  ],
  [
    "case action RPC",
    /create function public\.take_case_action_after_evidence_review\(/,
  ],
  [
    "case action officer ownership",
    /officer_assignment\.case_id = v_decision\.case_id[\s\S]*officer_assignment\.assigned_officer_id = v_officer_id[\s\S]*officer_assignment\.is_active = true/,
  ],
  [
    "approved evidence moves case forward",
    /v_action = 'move_forward'[\s\S]*v_decision\.decision <> 'approved'[\s\S]*v_next_status := 'investigating'/,
  ],
  [
    "rejected evidence triggers information request",
    /v_action = 'request_information'[\s\S]*case_information_requests[\s\S]*v_next_status := 'awaiting_information'/,
  ],
  [
    "unclear evidence can be reassigned",
    /v_action in \('request_clarification', 'reassign_evidence'\)[\s\S]*v_decision\.decision not in \('escalated', 'replacement_requested'\)[\s\S]*validation_status = 'pending'/,
  ],
  [
    "public update excludes internal timeline",
    /'case_update_after_evidence_review'[\s\S]*v_public_update[\s\S]*true/,
  ],
  [
    "internal case action timeline stays protected",
    /'evidence_case_action_taken'[\s\S]*v_internal_note[\s\S]*false/,
  ],
];

for (const [name, pattern] of requirements) {
  assert.match(migration, pattern, `Missing requirement: ${name}`);
}

assert.match(
  officerScreen,
  /<ConfirmDialog[\s\S]*title="Assign evidence\?"/,
  "The Officer must confirm an evidence assignment.",
);
assert.match(
  officerScreen,
  /selectedEvidence\.validation_status !== "pending"/,
  "The Officer UI must block non-pending evidence.",
);
assert.match(
  validatorApi,
  /error\.code === "PGRST202" \|\| error\.code === "42883"/,
  "The assignment queue must not depend on the later verification-history story.",
);
assert.match(
  officerEvidenceScreen,
  /get_officer_evidence_verification_results/,
  "The Officer evidence screen must load verification results through the authorized RPC.",
);
assert.match(
  officerEvidenceScreen,
  /Reporter-visible message/,
  "The Officer evidence screen must label reporter-visible verification text separately.",
);
assert.match(
  officerEvidenceScreen,
  /Internal officer notes/,
  "The Officer evidence screen must label internal verification notes separately.",
);
assert.match(
  officerEvidenceScreen,
  /take_case_action_after_evidence_review/,
  "The Officer evidence screen must call the post-review case action RPC.",
);
assert.match(
  officerEvidenceScreen,
  /Move case forward/,
  "Verified evidence must offer a move-forward action.",
);
assert.match(
  officerEvidenceScreen,
  /Request information/,
  "Rejected evidence must offer an additional-information action.",
);
assert.match(
  officerEvidenceScreen,
  /Reassign evidence/,
  "Unclear evidence must offer a reassignment action.",
);

console.log("Evidence assignment contract tests passed.");
