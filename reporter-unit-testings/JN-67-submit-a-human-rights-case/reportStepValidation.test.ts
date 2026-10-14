import {
  districtsByProvince,
  incidentCategories,
  provinces,
  reportSteps,
} from "../../src/reporter/report/options";
import { initialCaseDraft } from "../../src/reporter/report/types";
import { isFutureDate, validateReportStep } from "../../src/reporter/report/validation";
import { makeDraft } from "../helpers/fixtures";

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("JN-67 Submit a case - incident date checks", () => {
  it("detects dates after today", () => {
    expect(isFutureDate("2026-10-15")).toBe(true);
    expect(isFutureDate("2027-01-01")).toBe(true);
  });

  it("treats today and past dates as valid", () => {
    expect(isFutureDate("2026-10-14")).toBe(false);
    expect(isFutureDate("2020-02-29")).toBe(false);
  });

  it("returns false for values not in YYYY-MM-DD format", () => {
    expect(isFutureDate("15/10/2030")).toBe(false);
    expect(isFutureDate("")).toBe(false);
  });
});

describe("JN-67 Submit a case - step validation", () => {
  it("passes every step for a complete draft", () => {
    const draft = makeDraft();

    for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(validateReportStep(step, draft)).toBeNull();
    }
  });

  it("step 1 requires a reporting mode", () => {
    expect(validateReportStep(1, makeDraft({ reportingMode: "" as never }))).toBe(
      "Choose how you would like to report this case.",
    );
    expect(validateReportStep(1, makeDraft({ reportingMode: "anonymous" }))).toBeNull();
  });

  describe("step 2 - incident category", () => {
    it("requires at least one category", () => {
      expect(validateReportStep(2, makeDraft({ categories: [] }))).toBe(
        "Please select at least one incident category.",
      );
    });

    it("accepts category codes and ids", () => {
      expect(
        validateReportStep(2, makeDraft({ categories: ["discrimination", "cat_child_rights"] })),
      ).toBeNull();
    });

    it("rejects unknown categories", () => {
      expect(validateReportStep(2, makeDraft({ categories: ["made_up"] }))).toContain(
        'Invalid or inactive category selection: "made_up"',
      );
    });
  });

  describe("step 3 - incident details", () => {
    it.each([
      [{ title: "  " }, "Enter a short case title."],
      [{ description: "" }, "Tell us what happened."],
      [{ incidentDate: " " }, "Enter the date of the incident."],
      [{ incidentDate: "01/09/2026" }, "Use the date format YYYY-MM-DD."],
      [{ incidentDate: "2026-10-15" }, "The incident date cannot be in the future."],
      [{ ongoing: "" as const }, "Tell us whether the incident is still ongoing."],
    ])("rejects %p", (overrides, message) => {
      expect(validateReportStep(3, makeDraft(overrides))).toBe(message);
    });

    it("accepts an incident that happened today", () => {
      expect(validateReportStep(3, makeDraft({ incidentDate: "2026-10-14" }))).toBeNull();
    });

    it.each(["yes", "no", "unsure"] as const)("accepts ongoing = %p", (ongoing) => {
      expect(validateReportStep(3, makeDraft({ ongoing }))).toBeNull();
    });
  });

  describe("step 4 - location", () => {
    it("requires a province and district", () => {
      expect(validateReportStep(4, makeDraft({ province: "" }))).toBe("Select a province.");
      expect(validateReportStep(4, makeDraft({ district: "" }))).toBe("Select a district.");
    });
  });

  describe("step 5 - affected person", () => {
    it("requires who the report is for", () => {
      expect(validateReportStep(5, makeDraft({ victimRelation: "" }))).toBe(
        "Tell us whether you are reporting for yourself or another person.",
      );
      expect(validateReportStep(5, makeDraft({ victimRelation: "other" }))).toBeNull();
    });
  });

  it("does not block the optional witness, evidence, privacy and review steps", () => {
    const draft = makeDraft({ witnesses: [], pendingEvidence: [] });

    expect(validateReportStep(6, draft)).toBeNull();
    expect(validateReportStep(7, draft)).toBeNull();
    expect(validateReportStep(8, draft)).toBeNull();
    expect(validateReportStep(9, draft)).toBeNull();
  });
});

describe("JN-67 Submit a case - form options", () => {
  it("has nine report steps in order", () => {
    expect(reportSteps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(reportSteps[8].path).toBe("/reporter/report/review");
  });

  it("lists districts for every province", () => {
    for (const province of provinces) {
      expect(districtsByProvince[province]?.length).toBeGreaterThan(0);
    }
  });

  it("starts with privacy-friendly defaults", () => {
    expect(initialCaseDraft).toMatchObject({
      reportingMode: "identified",
      isInstantReport: false,
      categories: [],
      hideIdentity: true,
      discreetNotifications: true,
      contactMethod: "app",
      province: "Western Province",
      district: "Colombo",
    });
    expect(districtsByProvince[initialCaseDraft.province]).toContain(initialCaseDraft.district);
  });

  it("offers category ids that the step 2 validator accepts", () => {
    for (const category of incidentCategories) {
      expect(validateReportStep(2, makeDraft({ categories: [category.id] }))).toBeNull();
    }
  });
});
