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

console.log("Evidence assignment contract tests passed.");
