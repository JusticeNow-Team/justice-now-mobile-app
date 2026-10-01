import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { getPaginatedAuditEvents } from "../../audit";
import {
  canDeleteCategory,
  createCategory,
  deleteCategory,
  getActiveCategories,
  getCategories,
  getCategoryByCode,
  getCategoryById,
  INITIAL_REPORT_CATEGORIES,
  ReportCategory,
  resetCategoriesToDefault,
  toggleCategoryActive,
  updateCategory,
  validateSelectedCategories,
} from "../index";

const ADMIN_ACTOR = {
  userId: "usr_admin_001",
  email: "admin@justicenow.org",
  role: "system_admin",
};

const UNAUTHORIZED_ACTOR = {
  userId: "usr_reporter_002",
  email: "reporter@example.com",
  role: "reporter",
};

describe("Sprint 4: Manage Report Categories (JN-378 to JN-384)", () => {
  beforeEach(() => {
    resetCategoriesToDefault();
  });

  // ==========================================================================
  // Static Contract Verification (JN-379)
  // ==========================================================================
  describe("JN-379: Category Management Domain Model & Retrieval", () => {
    it("should export required category model properties including case safety and default flags", () => {
      const sample = INITIAL_REPORT_CATEGORIES[0];

      assert.ok(typeof sample.id === "string", "id must be a string");
      assert.ok(typeof sample.code === "string", "code must be a string");
      assert.ok(typeof sample.name === "string", "name must be a string");
      assert.ok(typeof sample.description === "string", "description must be a string");
      assert.ok(typeof sample.isActive === "boolean", "isActive must be a boolean");
      assert.ok(typeof sample.isSystemDefault === "boolean", "isSystemDefault must be boolean");
      assert.ok(typeof sample.activeCaseCount === "number", "activeCaseCount must be number");
    });

    it("should retrieve full category list with filter options (all, active, inactive, search)", async () => {
      const all = await getCategories({ statusFilter: "all" });
      assert.ok(all.length >= 10, "Should have at least 10 seed categories");

      const filtered = await getCategories({ searchQuery: "Detention" });
      assert.ok(filtered.length >= 1, "Search should match Unlawful Detention");
      assert.equal(filtered[0].code, "unlawful_detention");
    });
  });

  // ==========================================================================
  // AC 1 & JN-380: Category Creation
  // ==========================================================================
  describe("AC 1 & JN-380: Admin Category Creation", () => {
    it("should allow authorized System Admin to create a new category with valid inputs", async () => {
      const result = await createCategory(
        {
          name: "Indigenous Land Rights Violation",
          code: "indigenous_land_rights",
          description: "Illegal encroachment, forced relocation, or natural resource exploitation on ancestral lands.",
          hint: "Land theft or destruction of tribal territory",
          icon: "shield",
          isActive: true,
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, true);
      assert.ok(result.category);
      assert.equal(result.category?.name, "Indigenous Land Rights Violation");
      assert.equal(result.category?.code, "indigenous_land_rights");
      assert.equal(result.category?.isActive, true);

      // Verify category is retrievable
      const retrieved = await getCategoryByCode("indigenous_land_rights");
      assert.ok(retrieved !== null);
      assert.equal(retrieved?.name, "Indigenous Land Rights Violation");
    });

    it("should auto-generate snake_case code if code is omitted", async () => {
      const result = await createCategory(
        {
          name: "Whistleblower Retaliation",
          description: "Adverse actions, termination, or harassment targeted at individuals reporting public corruption.",
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, true);
      assert.equal(result.category?.code, "whistleblower_retaliation");
    });

    it("should reject creation attempts from unauthorized roles", async () => {
      const result = await createCategory(
        {
          name: "Unauthorized Category",
          description: "Attempted by a non-admin role",
        },
        UNAUTHORIZED_ACTOR,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized") || result.error?.includes("System Administrator"));
    });
  });

  // ==========================================================================
  // AC 2 & JN-381: Category Update
  // ==========================================================================
  describe("AC 2 & JN-381: Admin Category Update", () => {
    it("should allow authorized Admin to update category name, description, hint, and icon", async () => {
      const result = await updateCategory(
        "cat_discrimination",
        {
          name: "Systemic Discrimination & Exclusion",
          description: "Institutional or individual discrimination based on race, religion, gender, or disability.",
          hint: "Unfair exclusion or bias based on identity",
          icon: "users",
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, true);
      assert.equal(result.category?.name, "Systemic Discrimination & Exclusion");
      assert.equal(result.category?.hint, "Unfair exclusion or bias based on identity");
      assert.equal(result.category?.icon, "users");

      const retrieved = await getCategoryById("cat_discrimination");
      assert.equal(retrieved?.name, "Systemic Discrimination & Exclusion");
    });

    it("should reject update attempts from unauthorized non-admin users", async () => {
      const result = await updateCategory(
        "cat_discrimination",
        {
          name: "Malicious Category Rename",
        },
        UNAUTHORIZED_ACTOR,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized"));
    });
  });

  // ==========================================================================
  // AC 3 & JN-382: Activation & Deactivation
  // ==========================================================================
  describe("AC 3 & JN-382: Category Activation & Deactivation", () => {
    it("should toggle a category from active to inactive", async () => {
      const result = await toggleCategoryActive("cat_child_rights", false, ADMIN_ACTOR);
      assert.equal(result.success, true);
      assert.equal(result.category?.isActive, false);

      const retrieved = await getCategoryById("cat_child_rights");
      assert.equal(retrieved?.isActive, false);
    });

    it("should toggle a category from inactive back to active", async () => {
      await toggleCategoryActive("cat_child_rights", false, ADMIN_ACTOR);
      const reactivated = await toggleCategoryActive("cat_child_rights", true, ADMIN_ACTOR);

      assert.equal(reactivated.success, true);
      assert.equal(reactivated.category?.isActive, true);
    });

    it("should reject activation/deactivation by unauthorized users", async () => {
      const result = await toggleCategoryActive("cat_child_rights", false, UNAUTHORIZED_ACTOR);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized"));
    });
  });

  // ==========================================================================
  // AC 4: Duplicate Name & Code Prevention (JN-380 / JN-381)
  // ==========================================================================
  describe("AC 4: Duplicate Name & Code Prevention", () => {
    it("should reject creating a category with duplicate name (case-insensitive)", async () => {
      const result = await createCategory(
        {
          name: "unlawful detention", // duplicate of existing
          code: "new_unique_code_xyz",
          description: "Testing duplicate name rejection",
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("already exists"));
    });

    it("should reject creating a category with duplicate code", async () => {
      const result = await createCategory(
        {
          name: "Unique Category Name XYZ",
          code: "unlawful_detention", // duplicate code
          description: "Testing duplicate code rejection",
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("already exists"));
    });

    it("should reject updating a category name to another existing category name", async () => {
      const result = await updateCategory(
        "cat_child_rights",
        {
          name: "Unlawful Detention", // belongs to cat_unlawful_detention
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("already exists"));
    });

    it("should allow updating a category while retaining its own name", async () => {
      const result = await updateCategory(
        "cat_unlawful_detention",
        {
          name: "Unlawful Detention", // same name
          description: "Updated legal description of detention without due process.",
        },
        ADMIN_ACTOR,
      );

      assert.equal(result.success, true);
      assert.equal(result.category?.description, "Updated legal description of detention without due process.");
    });
  });

  // ==========================================================================
  // AC 5 & JN-383: Protect Categories Referenced by Cases
  // ==========================================================================
  describe("AC 5 & JN-383: Protect Categories Used by Cases from Unsafe Deletion", () => {
    it("should block deletion if category is referenced by active cases", async () => {
      const targetCategory = (await getCategoryById("cat_violence_abuse")) as ReportCategory;
      assert.ok((targetCategory.activeCaseCount ?? 0) > 0, "Seed category has active cases");

      const safety = canDeleteCategory(targetCategory);
      assert.equal(safety.allowed, false);
      assert.ok(safety.reason?.includes("referenced by"));
      assert.ok(safety.reason?.includes("deactivate this category instead"));

      // Service level deletion attempt
      const result = await deleteCategory("cat_violence_abuse", ADMIN_ACTOR);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("referenced by"));
    });

    it("should block deletion of core system default categories", async () => {
      const defaultCat: ReportCategory = {
        id: "cat_system_core",
        code: "system_core",
        name: "Core Classification",
        description: "Core system default classification",
        isActive: true,
        isSystemDefault: true,
        activeCaseCount: 0,
        displayOrder: 99,
      };

      const safety = canDeleteCategory(defaultCat);
      assert.equal(safety.allowed, false);
      assert.ok(safety.reason?.includes("System default"));
    });

    it("should safely allow deletion of an unreferenced, non-default category", async () => {
      // Create temporary non-default category
      const createRes = await createCategory(
        {
          name: "Temporary Obsolete Category",
          code: "temporary_obsolete",
          description: "Category created by mistake with no cases linked.",
          isSystemDefault: false,
        },
        ADMIN_ACTOR,
      );

      assert.equal(createRes.success, true);
      const catId = createRes.category!.id;

      // Delete the unreferenced category
      const deleteRes = await deleteCategory(catId, ADMIN_ACTOR);
      assert.equal(deleteRes.success, true);

      // Verify category is gone
      const check = await getCategoryById(catId);
      assert.equal(check, null);
    });
  });

  // ==========================================================================
  // AC 6 & JN-140: Only Active Categories Available to Reporters
  // ==========================================================================
  describe("AC 6 & JN-140: Reporter Active Category Access", () => {
    it("should exclude deactivated categories from getActiveCategories()", async () => {
      await toggleCategoryActive("cat_other", false, ADMIN_ACTOR);

      const activeList = await getActiveCategories();
      const activeCodes = activeList.map((c) => c.code);

      assert.ok(!activeCodes.includes("other"), "Deactivated category must not be in active reporter list");
      assert.ok(activeCodes.includes("unlawful_detention"), "Active category must remain in reporter list");
    });

    it("should reject case submission selection containing deactivated category", async () => {
      await toggleCategoryActive("cat_harassment", false, ADMIN_ACTOR);
      const allCategories = await getCategories();

      const validation = validateSelectedCategories(["harassment"], allCategories);
      assert.equal(validation.isValid, false);
      assert.ok(validation.error?.includes("Invalid or inactive category"));
    });

    it("should accept case submission selection containing valid active categories", async () => {
      const allCategories = await getCategories();
      const validation = validateSelectedCategories(["unlawful_detention", "discrimination"], allCategories);

      assert.equal(validation.isValid, true);
      assert.equal(validation.invalidSelections.length, 0);
    });
  });

  // ==========================================================================
  // AC 7 & JN-384: Audit Events Recorded for All Operations
  // ==========================================================================
  describe("AC 7 & JN-384: Administrative Category Audit Event Logging", () => {
    it("should record CATEGORY_CREATED audit event on creation", async () => {
      await createCategory(
        {
          name: "Audited Category Test",
          code: "audited_category_test",
          description: "Verifying audit event generation for category creation.",
        },
        ADMIN_ACTOR,
      );

      const logs = await getPaginatedAuditEvents(
        { category: "category" },
        ADMIN_ACTOR as any,
      );

      const createdEvent = logs.events.find(
        (e) => e.eventType === "CATEGORY_CREATED" && e.targetEmail === "Audited Category Test",
      );

      assert.ok(createdEvent !== undefined, "CATEGORY_CREATED event must be present");
      assert.equal(createdEvent?.actorEmail, ADMIN_ACTOR.email);
    });

    it("should record CATEGORY_UPDATED audit event on update", async () => {
      await updateCategory(
        "cat_unlawful_detention",
        {
          description: "Updated description for audit logging verification.",
        },
        ADMIN_ACTOR,
      );

      const logs = await getPaginatedAuditEvents(
        { category: "category" },
        ADMIN_ACTOR as any,
      );

      const updatedEvent = logs.events.find(
        (e) => e.eventType === "CATEGORY_UPDATED" && e.targetId === "cat_unlawful_detention",
      );

      assert.ok(updatedEvent !== undefined, "CATEGORY_UPDATED event must be present");
      assert.equal(updatedEvent?.actorEmail, ADMIN_ACTOR.email);
    });

    it("should record CATEGORY_DEACTIVATED audit event on deactivation", async () => {
      await toggleCategoryActive("cat_child_rights", false, ADMIN_ACTOR);

      const logs = await getPaginatedAuditEvents(
        { category: "category" },
        ADMIN_ACTOR as any,
      );

      const deactivatedEvent = logs.events.find(
        (e) => e.eventType === "CATEGORY_DEACTIVATED" && e.targetId === "cat_child_rights",
      );

      assert.ok(deactivatedEvent !== undefined, "CATEGORY_DEACTIVATED event must be present");
    });
  });
});
