import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("./seeds/007_case_withdrawal_review.sql", import.meta.url),
  "utf8",
);
const officerCaseDetails = await readFile(
  new URL("../src/app/officer/case-details.tsx", import.meta.url),
  "utf8",
);
const reporterCaseDetailApi = await readFile(
  new URL("../src/reporter/cases/getReporterCaseDetail.ts", import.meta.url),
  "utf8",
);
const reporterCaseDetailScreen = await readFile(
  new URL("../src/reporter/cases/CaseDetailScreen.tsx", import.meta.url),
  "utf8",
);

const sqlRequirements = [
  [
    "withdrawal request review columns",
    /alter table public\.case_withdrawal_requests[\s\S]*add column if not exists reviewed_by_officer_id[\s\S]*add column if not exists decision_reason[\s\S]*add column if not exists reviewed_at/i,
  ],
  [
    "one pending withdrawal request per case",
    /create unique index[\s\S]*case_withdrawal_requests_one_pending_per_case[\s\S]*where status in \('requested', 'pending'\)/i,
  ],
  [
    "authorized officer list RPC",
    /create function public\.get_officer_case_withdrawal_requests\(/,
  ],
  [
    "authorized officer ownership enforcement",
    /officer_assignment\.case_id = p_case_id[\s\S]*officer_assignment\.assigned_officer_id = v_officer_id[\s\S]*officer_assignment\.is_active = true/,
  ],
  [
    "review RPC",
    /create function public\.review_case_withdrawal_request\(/,
  ],
  [
    "decision reason required",
    /length\(v_reason\) < 10[\s\S]*Add a decision reason before submitting/,
  ],
  [
    "approve closes case",
    /v_decision = 'approved'[\s\S]*v_next_status := 'closed'/,
  ],
  [
    "reject restores active case",
    /v_decision = 'approved'[\s\S]*else[\s\S]*old_status::text[\s\S]*v_next_status := 'investigating'/,
  ],
  [
    "status history is recorded",
    /insert into public\.case_status_history[\s\S]*v_previous_status::public\.case_status[\s\S]*v_next_status::public\.case_status/,
  ],
  [
    "internal timeline remains protected",
    /'withdrawal_request_reviewed'[\s\S]*false/,
  ],
  [
    "Reporter-visible timeline decision",
    /'withdrawal_decision_available'[\s\S]*v_public_description[\s\S]*true/,
  ],
];

for (const [name, pattern] of sqlRequirements) {
  assert.match(migration, pattern, `Missing SQL requirement: ${name}`);
}

assert.match(
  officerCaseDetails,
  /get_officer_case_withdrawal_requests/,
  "Officer case details must load authorized withdrawal requests.",
);
assert.match(
  officerCaseDetails,
  /review_case_withdrawal_request/,
  "Officer case details must submit withdrawal decisions through the review RPC.",
);
assert.match(
  officerCaseDetails,
  /Decision reason/,
  "Officer case details must require and display a decision reason.",
);
assert.match(
  officerCaseDetails,
  /Approve withdrawal/,
  "Officer case details must expose the approve action.",
);
assert.match(
  officerCaseDetails,
  /Reject request/,
  "Officer case details must expose the reject action.",
);

assert.match(
  reporterCaseDetailApi,
  /reviewed_at, decision_reason/,
  "Reporter case detail API must fetch withdrawal decision fields.",
);
assert.match(
  reporterCaseDetailScreen,
  /Decision reason/,
  "Reporter case detail screen must show the withdrawal decision reason.",
);
assert.match(
  reporterCaseDetailScreen,
  /Withdrawal approved/,
  "Reporter case detail screen must inform the Reporter about approval.",
);
assert.match(
  reporterCaseDetailScreen,
  /Withdrawal rejected/,
  "Reporter case detail screen must inform the Reporter about rejection.",
);

console.log("Withdrawal review contract tests passed.");
