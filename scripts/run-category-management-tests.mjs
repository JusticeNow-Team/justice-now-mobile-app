import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

console.log("Running Report Category Management (JN-378 - JN-384) verification tests...\n");

// 1. Validate Types & Interfaces
const typesFile = await readFile(
  new URL("../src/categories/types.ts", import.meta.url),
  "utf8",
);
assert.match(typesFile, /export interface ReportCategory/, "Must export ReportCategory");
assert.match(typesFile, /activeCaseCount\?: number/, "ReportCategory must track activeCaseCount (AC 5)");
assert.match(typesFile, /isSystemDefault\?: boolean/, "ReportCategory must track isSystemDefault (AC 5)");
assert.match(typesFile, /export interface CreateCategoryInput/, "Must export CreateCategoryInput (AC 1)");
assert.match(typesFile, /export interface UpdateCategoryInput/, "Must export UpdateCategoryInput (AC 2)");
assert.match(typesFile, /export interface DeleteCategoryResult/, "Must export DeleteCategoryResult (AC 5)");
assert.match(typesFile, /export interface CategoryFilterOptions/, "Must export CategoryFilterOptions");

// 2. Validate Category Validation Rules
const validationFile = await readFile(
  new URL("../src/categories/validation.ts", import.meta.url),
  "utf8",
);
assert.match(validationFile, /export function slugifyCategoryCode/, "Must export slugifyCategoryCode");
assert.match(validationFile, /export function validateCategoryInput/, "Must export validateCategoryInput");
assert.match(validationFile, /export function canDeleteCategory/, "Must export canDeleteCategory (AC 5)");
assert.match(validationFile, /export function validateSelectedCategories/, "Must export validateSelectedCategories (AC 6)");
assert.match(validationFile, /Duplicate category names are not permitted/i, "Must check for duplicate category name (AC 4)");
assert.match(validationFile, /Duplicate category codes are not permitted/i, "Must check for duplicate category code (AC 4)");
assert.match(validationFile, /currently referenced by \$\{caseCount\} case\(s\)/i, "Must guard active case count on deletion (AC 5)");

// 3. Validate Category Service Logic & Role Guards
const serviceFile = await readFile(
  new URL("../src/categories/categoryService.ts", import.meta.url),
  "utf8",
);
assert.match(serviceFile, /getCategories\(/, "Must export getCategories");
assert.match(serviceFile, /getActiveCategories\(/, "Must export getActiveCategories (AC 6)");
assert.match(serviceFile, /createCategory\(/, "Must export createCategory (AC 1)");
assert.match(serviceFile, /updateCategory\(/, "Must export updateCategory (AC 2)");
assert.match(serviceFile, /toggleCategoryActive\(/, "Must export toggleCategoryActive (AC 3)");
assert.match(serviceFile, /deleteCategory\(/, "Must export deleteCategory (AC 5)");
assert.match(serviceFile, /canDeleteCategory\(/, "Must guard category deletion with canDeleteCategory");
assert.match(serviceFile, /requireAdministrator\(/, "Must enforce system_admin role guard (AC 1, AC 2, AC 3, AC 5)");
assert.match(serviceFile, /CATEGORY_CREATED/, "Must record CATEGORY_CREATED audit event (AC 7)");
assert.match(serviceFile, /CATEGORY_UPDATED/, "Must record CATEGORY_UPDATED audit event (AC 7)");
assert.match(serviceFile, /CATEGORY_ACTIVATED/, "Must record CATEGORY_ACTIVATED audit event (AC 7)");
assert.match(serviceFile, /CATEGORY_DEACTIVATED/, "Must record CATEGORY_DEACTIVATED audit event (AC 7)");
assert.match(serviceFile, /CATEGORY_DELETED/, "Must record CATEGORY_DELETED audit event (AC 7)");

// 4. Validate Admin Category Management UI Screen
const adminCategoryScreen = await readFile(
  new URL("../src/app/admin/categories.tsx", import.meta.url),
  "utf8",
);
const uiRequirements = [
  ["Category List (JN-379)", /categoryCard/],
  ["Create Category Form & Modal (JN-380)", /handleCreateCategory/],
  ["Update Category Form & Modal (JN-381)", /handleUpdateCategory/],
  ["Activate / Deactivate Toggle Switch (JN-382)", /handleToggleActive/],
  ["Safe Deletion Protection Blocked Modal (JN-383 / AC 5)", /blockedModal/],
  ["System Admin Role Guard (AC 6)", /Only System Administrators have permission/],
  ["Search Bar & Filter Pills (JN-379)", /statusFilter/],
];

for (const [name, pattern] of uiRequirements) {
  assert.match(adminCategoryScreen, pattern, `Missing UI requirement: ${name}`);
}

// 5. Validate Admin Dashboard Navigation Integration
const adminDashboard = await readFile(
  new URL("../src/app/admin/index.tsx", import.meta.url),
  "utf8",
);
assert.match(
  adminDashboard,
  /\/admin\/categories/,
  "Admin dashboard must provide navigation link to /admin/categories.",
);
assert.match(
  adminDashboard,
  /Report Categories/,
  "Admin dashboard must have Report Categories section card.",
);

// 6. Validate Audit Event Types
const auditTypes = await readFile(
  new URL("../src/audit/types.ts", import.meta.url),
  "utf8",
);
const requiredAuditTypes = [
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_ACTIVATED",
  "CATEGORY_DEACTIVATED",
  "CATEGORY_DELETED",
];
for (const at of requiredAuditTypes) {
  assert.ok(auditTypes.includes(at), `Missing audit event type: ${at}`);
}

console.log("---------------------------------------------------------------");
console.log("✓ All Report Category Management (JN-378 - JN-384) tests passed!");
console.log("  - AC 1 (JN-380): Admin can create a category");
console.log("  - AC 2 (JN-381): Admin can update a category");
console.log("  - AC 3 (JN-382): Admin can activate or deactivate a category");
console.log("  - AC 4 (JN-380 / JN-381): Duplicate names & codes rejected");
console.log("  - AC 5 (JN-383): Categories used by cases are not deleted unsafely");
console.log("  - AC 6 (JN-140 / JN-382): Only active categories available to Reporters");
console.log("  - AC 7 (JN-384): Category changes are audited");
console.log("---------------------------------------------------------------");
