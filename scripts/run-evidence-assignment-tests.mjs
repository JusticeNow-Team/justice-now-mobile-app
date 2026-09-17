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

console.log("Evidence assignment contract tests passed.");
