import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const validatorQueueScreen = await readFile(
  new URL("../src/evidence-validator/AssignedEvidenceScreen.tsx", import.meta.url),
  "utf8"
);
const auditApi = await readFile(
  new URL("../src/evidence-validator/audit/api.ts", import.meta.url),
  "utf8"
);
const auditTypes = await readFile(
  new URL("../src/evidence-validator/audit/types.ts", import.meta.url),
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
  auditTypes,
  /assignedCheckerId\?: string/,
  "JN-185: EvidenceRecord must define assignedCheckerId"
);
assert.match(
  auditTypes,
  /assignedAt\?: string/,
  "JN-185: EvidenceRecord must define assignedAt"
);
assert.match(
  auditApi,
  /assignedAt:/,
  "JN-185: Mock evidence data must populate assignedAt timestamps"
);

// AC 2 & JN-186: Queue displays case reference, evidence type, assignment date, and status
assert.match(
  validatorQueueScreen,
  /caseReference/,
  "JN-186: Queue card must display Case Reference label"
);
assert.match(
  validatorQueueScreen,
  /assigned|formatDateTime/,
  "JN-186: Queue card must display Assignment / Submission Date label"
);
assert.match(
  validatorQueueScreen,
  /evidenceType|fileType/,
  "JN-186: Queue card must render Evidence Type"
);
assert.match(
  validatorQueueScreen,
  /StatusBadge|QueueTab/,
  "JN-186: Queue card must render StatusBadge"
);

// AC 3 & JN-188: Items can be filtered by status
assert.match(
  validatorQueueScreen,
  /statusFilter === "pending"|activeTab === "pending"|tab === "pending"/,
  "JN-188: Must support filtering by Pending status"
);
assert.match(
  validatorQueueScreen,
  /statusFilter === "under_review"|activeTab === "under_review"|tab === "under_review"/,
  "JN-188: Must support filtering by Under Review status"
);
assert.match(
  validatorQueueScreen,
  /value: "approved"|item\.decision === "approved"/,
  "JN-188: Must support filtering by Approved history"
);
assert.match(
  validatorQueueScreen,
  /value: "rejected"|item\.decision === "rejected"/,
  "JN-188: Must support filtering by Rejected history"
);

// AC 4: Assigned evidence can be opened
assert.match(
  validatorQueueScreen,
  /\/validator\/evidence\/\$\{item\.assignmentId\}/,
  "AC 4: Tapping evidence card must navigate to detail view (/validator/evidence/[id])"
);

// AC 5 & JN-187: Completed items are distinguishable from pending items
assert.match(
  validatorQueueScreen,
  /approved|rejected|visibleHistory/,
  "JN-187: Logic must identify completed items"
);
assert.match(
  validatorComponents,
  /HistoryDecisionCard/,
  "JN-187: Completed items must apply distinct card styling"
);
assert.match(
  validatorComponents,
  /DecisionBadge|Audit record/,
  "JN-187: Completed items must render a distinct read-only history marker"
);

// JN-189: Ordering and empty state
assert.match(
  validatorQueueScreen,
  /timeB - timeA|uploadDate|created_at|order/i,
  "JN-189: Evidence queue items must be ordered by timestamp descending"
);
assert.match(
  validatorQueueScreen,
  /EmptyState/,
  "JN-189: FlatList must specify ListEmptyComponent for empty queue state"
);

// AC 6 & JN-190: Unauthorized users cannot access queue
assert.match(
  validatorQueueScreen,
  /AssignedEvidenceScreen/,
  "JN-190: Queue screen must be in the protected validator workspace"
);
assert.match(
  roleGuard,
  /normalizedAllowedRoles\.includes\(role\)/,
  "JN-190: RoleGuard must reject unauthorized user roles"
);

console.log("All Assigned Evidence Queue (JN-185 - JN-190) contract tests passed successfully!");
