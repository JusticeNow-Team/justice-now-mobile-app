import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkerScreen = await readFile(
  new URL("../src/app/checker/index.tsx", import.meta.url),
  "utf8"
);
const checkerApi = await readFile(
  new URL("../src/checker/api.ts", import.meta.url),
  "utf8"
);
const checkerTypes = await readFile(
  new URL("../src/checker/types.ts", import.meta.url),
  "utf8"
);
const assignedScreen = await readFile(
  new URL("../src/evidence-validator/AssignedEvidenceScreen.tsx", import.meta.url),
  "utf8"
);
const validatorComponents = await readFile(
  new URL("../src/evidence-validator/components.tsx", import.meta.url),
  "utf8"
);
const roleGuard = await readFile(
  new URL("../src/auth/guards/RoleGuard.tsx", import.meta.url),
  "utf8"
);

console.log("Running Assigned Evidence Queue (JN-185 - JN-190) verification tests...\n");

// AC 1 & JN-185: Evidence Checker sees relevant assigned evidence
assert.match(
  checkerTypes,
  /assignedCheckerId\?: string/,
  "JN-185: EvidenceRecord must define assignedCheckerId"
);
assert.match(
  checkerTypes,
  /assignedAt\?: string/,
  "JN-185: EvidenceRecord must define assignedAt"
);
assert.match(
  checkerApi,
  /assignedAt:/,
  "JN-185: Mock evidence data must populate assignedAt timestamps"
);

// AC 2 & JN-186: Queue displays case reference, evidence type, assignment date, and status
assert.match(
  checkerScreen,
  /Case Reference:/,
  "JN-186: Queue card must display Case Reference label"
);
assert.match(
  checkerScreen,
  /Assignment Date:/,
  "JN-186: Queue card must display Assignment Date label"
);
assert.match(
  checkerScreen,
  /record\.evidenceType/,
  "JN-186: Queue card must render Evidence Type"
);
assert.match(
  checkerScreen,
  /<StatusBadge status=\{record\.validationStatus\} \/>/,
  "JN-186: Queue card must render StatusBadge"
);

// AC 3 & JN-188: Items can be filtered by status
assert.match(
  checkerScreen,
  /activeTab === "pending"/,
  "JN-188: Must support filtering by Pending status"
);
assert.match(
  checkerScreen,
  /activeTab === "completed"/,
  "JN-188: Must support filtering by Completed status"
);
assert.match(
  checkerScreen,
  /activeTab === "validated"/,
  "JN-188: Must support filtering by Validated status"
);
assert.match(
  checkerScreen,
  /activeTab === "rejected"/,
  "JN-188: Must support filtering by Rejected status"
);

// AC 4: Assigned evidence can be opened
assert.match(
  checkerScreen,
  /pathname: "\/checker\/evidence\/\[id\]"/,
  "AC 4: Tapping evidence card must navigate to detail view (/checker/evidence/[id])"
);

// AC 5 & JN-187: Completed items are distinguishable from pending items
assert.match(
  checkerScreen,
  /isCompleted =/,
  "JN-187: Logic must identify completed items"
);
assert.match(
  checkerScreen,
  /completedEvidenceCard/,
  "JN-187: Completed items must apply distinct card styling"
);
assert.match(
  checkerScreen,
  /Completed Item/,
  "JN-187: Completed items must render a distinct completed badge/tag"
);

// JN-189: Ordering and empty state
assert.match(
  checkerScreen,
  /timeB - timeA/,
  "JN-189: Evidence queue items must be ordered by timestamp descending"
);
assert.match(
  checkerScreen,
  /ListEmptyComponent=/,
  "JN-189: FlatList must specify ListEmptyComponent for empty queue state"
);

// AC 6 & JN-190: Unauthorized users cannot access queue
assert.match(
  checkerScreen,
  /<RoleGuard allowedRoles=\{\["evidence_validator"\]\}>/,
  "JN-190: Queue screen must be protected by RoleGuard"
);
assert.match(
  roleGuard,
  /normalizedAllowedRoles\.includes\(role\)/,
  "JN-190: RoleGuard must reject unauthorized user roles"
);

console.log("All Assigned Evidence Queue (JN-185 - JN-190) contract tests passed successfully!");
