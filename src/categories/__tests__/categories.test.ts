import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  createCategory,
  getActiveCategories,
  getCachedActiveCategories,
  getCachedAllCategories,
  getCategories,
  getCategoryByCode,
  getCategoryById,
  INITIAL_REPORT_CATEGORIES,
  resetCategoriesToDefault,
  toggleCategoryActive,
  validateCategoryInput,
  validateSelectedCategories,
} from "../index";

describe("Jira Task JN-135: Provide Report Categories", () => {
  beforeEach(() => {
    resetCategoriesToDefault();
  });

  describe("Subtask JN-136: Report-Category Model & Data Structure (Acceptance Criteria 1)", () => {
    it("should conform to the report-category domain model structure", () => {
      const sample = INITIAL_REPORT_CATEGORIES[0];

      assert.ok(typeof sample.id === "string", "id should be a string");
      assert.ok(typeof sample.code === "string", "code should be a string");
      assert.ok(typeof sample.name === "string", "name should be a string");
      assert.ok(
        typeof sample.description === "string",
        "description should be a string"
      );
      assert.ok(
        typeof sample.isActive === "boolean",
        "isActive should be a boolean"
      );
      assert.ok(
        typeof sample.displayOrder === "number",
        "displayOrder should be a number"
      );
    });
  });

  describe("Subtask JN-137: Initial Category Seed Data (Acceptance Criteria 2)", () => {
    it("should have initial human-rights categories available", () => {
      const categories = getCachedAllCategories();
      assert.ok(categories.length >= 8, "Should have at least 8 initial categories");

      const codes = categories.map((c) => c.code);
      assert.ok(codes.includes("unlawful_detention"), "Unlawful detention exists");
      assert.ok(codes.includes("discrimination"), "Discrimination exists");
      assert.ok(codes.includes("violence_or_abuse"), "Violence or abuse exists");
      assert.ok(codes.includes("harassment"), "Harassment exists");
      assert.ok(codes.includes("freedom_of_expression"), "Freedom of expression exists");
      assert.ok(codes.includes("workplace_rights"), "Workplace rights exists");
      assert.ok(codes.includes("child_rights"), "Child rights exists");
      assert.ok(codes.includes("other"), "Other category exists");
    });
  });

  describe("Subtask JN-138 & AC 6: Category Retrieval Through Application", () => {
    it("should retrieve all categories through getCategories()", async () => {
      const all = await getCategories();
      assert.ok(all.length >= 8);
    });

    it("should retrieve a category by its unique code", async () => {
      const category = await getCategoryByCode("unlawful_detention");
      assert.ok(category !== null);
      assert.equal(category?.name, "Unlawful Detention");
    });

    it("should retrieve a category by its ID", async () => {
      const category = await getCategoryById("cat_discrimination");
      assert.ok(category !== null);
      assert.equal(category?.code, "discrimination");
    });

    it("should return null for non-existent category code or id", async () => {
      const nonExistent = await getCategoryByCode("non_existent_code");
      assert.equal(nonExistent, null);
    });
  });

  describe("Subtask JN-140 & AC 3: Active-Category Filtering", () => {
    it("should return only active categories when filtered", async () => {
      // Toggle a category to inactive
      await toggleCategoryActive("cat_other", false);

      const activeCategories = await getActiveCategories();
      const cachedActive = getCachedActiveCategories();

      const activeCodes = activeCategories.map((c) => c.code);
      assert.ok(!activeCodes.includes("other"), "Inactive category should not be in active list");

      const cachedActiveCodes = cachedActive.map((c) => c.code);
      assert.ok(!cachedActiveCodes.includes("other"), "Inactive category should not be in cached active list");
    });

    it("should include all categories when activeOnly is false", async () => {
      await toggleCategoryActive("cat_other", false);

      const all = await getCategories({ activeOnly: false });
      const codes = all.map((c) => c.code);
      assert.ok(codes.includes("other"), "Inactive category should be in full list");
    });
  });

  describe("Subtask JN-136 & AC 4: Duplicate Category Prevention", () => {
    it("should reject creating a category with a duplicate name (case-insensitive)", async () => {
      const result = await createCategory({
        name: "unlawful detention", // Case-insensitive duplicate
        code: "new_unique_code",
        description: "Test description",
      });

      assert.equal(result.success, false);
      assert.ok(
        result.error?.includes("Duplicate category names are not permitted") ||
          result.error?.includes("already exists")
      );
    });

    it("should validate category input directly", () => {
      const invalid = validateCategoryInput({
        name: "",
        code: "",
        description: "",
      });
      assert.equal(invalid.isValid, false);
      assert.ok(invalid.errors.length >= 3);
    });

    it("should reject creating a category with a duplicate code", async () => {
      const result = await createCategory({
        name: "Brand New Unique Category Name",
        code: "unlawful_detention", // Duplicate code
        description: "Test description",
      });

      assert.equal(result.success, false);
      assert.ok(
        result.error?.includes("Duplicate category codes are not permitted") ||
          result.error?.includes("already exists")
      );
    });

    it("should successfully create a category with a unique name and code", async () => {
      const result = await createCategory({
        name: "Environmental Rights Violation",
        code: "environmental_rights",
        description: "Violations relating to toxic pollution and land displacement.",
        icon: "🌿",
        isActive: true,
      });

      assert.equal(result.success, true);
      assert.equal(result.category?.name, "Environmental Rights Violation");
      assert.equal(result.category?.code, "environmental_rights");
    });
  });

  describe("Subtask JN-139 & AC 5: Submitted Case Category Association", () => {
    it("should validate and map category selections for case submission", () => {
      const selectedCodes = ["unlawful_detention", "discrimination"];
      const validation = validateSelectedCategories(selectedCodes);

      assert.equal(validation.isValid, true);
      assert.equal(validation.invalidSelections.length, 0);
    });
  });

  describe("Subtask JN-141 & AC 7: Test Valid and Invalid Category Selection", () => {
    it("should accept valid active category selection", () => {
      const result = validateSelectedCategories(["workplace_rights"]);
      assert.equal(result.isValid, true);
    });

    it("should reject empty category selection", () => {
      const result = validateSelectedCategories([]);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes("Select at least one"));
    });

    it("should reject invalid/unknown category selection", () => {
      const result = validateSelectedCategories(["fabricated_category_xyz"]);
      assert.equal(result.isValid, false);
      assert.ok(result.invalidSelections.includes("fabricated_category_xyz"));
      assert.ok(result.error?.includes("Invalid or inactive category"));
    });

    it("should reject selection of a deactivated category", async () => {
      await toggleCategoryActive("cat_discrimination", false);
      const allCategories = await getCategories({ activeOnly: false });

      const result = validateSelectedCategories(
        ["discrimination"],
        allCategories
      );
      assert.equal(result.isValid, false);
      assert.ok(result.invalidSelections.includes("discrimination"));
    });
  });
});
