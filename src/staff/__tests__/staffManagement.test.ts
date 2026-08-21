import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  canDeactivateStaff,
  checkDuplicateStaffEmail,
  createStaffAccount,
  getStaffAccountById,
  getStaffAccounts,
  getStaffAuditLogs,
  INITIAL_STAFF_ACCOUNTS,
  resetStaffToDefault,
  toggleStaffActive,
  validateStaffInput,
} from "../index";
import { isAccountActive, resolvePostLoginRedirect } from "../../auth/navigation";

describe("Jira Task JN-191: Manage Staff Accounts", () => {
  beforeEach(() => {
    resetStaffToDefault();
  });

  describe("Subtask JN-193 & AC 1: Staff Account List & Retrieval", () => {
    it("Retrieves seeded staff accounts with roles and status", async () => {
      const staffList = await getStaffAccounts();
      assert.ok(staffList.length >= 5, "Should have seeded staff accounts");

      const roles = staffList.map((s) => s.role);
      assert.ok(roles.includes("case_officer"), "Should contain Case Officer");
      assert.ok(roles.includes("evidence_checker"), "Should contain Evidence Checker");
      assert.ok(roles.includes("system_admin"), "Should contain System Admin");
    });

    it("Filters staff accounts by role correctly", async () => {
      const officers = await getStaffAccounts({ role: "case_officer" });
      assert.ok(officers.length > 0);
      assert.ok(officers.every((s) => s.role === "case_officer"));

      const checkers = await getStaffAccounts({ role: "evidence_checker" });
      assert.ok(checkers.length > 0);
      assert.ok(checkers.every((s) => s.role === "evidence_checker"));
    });

    it("Filters staff accounts by active/inactive status", async () => {
      const activeOnly = await getStaffAccounts({ status: "active" });
      assert.ok(activeOnly.every((s) => s.isActive === true));

      const inactiveOnly = await getStaffAccounts({ status: "inactive" });
      assert.ok(inactiveOnly.every((s) => s.isActive === false));
    });

    it("Finds staff account by ID", async () => {
      const staff = await getStaffAccountById("staff_admin_01");
      assert.ok(staff);
      assert.equal(staff.email, "admin@justicenow.org");
      assert.equal(staff.role, "system_admin");
    });
  });

  describe("Subtask JN-194 & AC 2: Create / Invite Staff Account", () => {
    it("Admin can create a new Case Officer staff account", async () => {
      const result = await createStaffAccount({
        fullName: "Officer Priyantha Silva",
        email: "officer.priyantha@justicenow.org",
        role: "case_officer",
        department: "Special Operations",
      });

      assert.equal(result.success, true);
      assert.ok(result.staff);
      assert.equal(result.staff.email, "officer.priyantha@justicenow.org");
      assert.equal(result.staff.role, "case_officer");
      assert.equal(result.staff.isActive, true);

      // Verify it appears in the list
      const staffList = await getStaffAccounts();
      assert.ok(staffList.some((s) => s.email === "officer.priyantha@justicenow.org"));
    });

    it("Admin can create a new Evidence Checker staff account", async () => {
      const result = await createStaffAccount({
        fullName: "Checker Saman Kumara",
        email: "checker.saman@justicenow.org",
        role: "evidence_checker",
        department: "Forensics Lab",
      });

      assert.equal(result.success, true);
      assert.equal(result.staff?.role, "evidence_checker");
    });
  });

  describe("Subtask JN-196 & AC 4: Account Validation & Duplicate Prevention", () => {
    it("Rejects staff creation with invalid email format", () => {
      const validation = validateStaffInput({
        fullName: "Test User",
        email: "not-an-email",
        role: "case_officer",
      });

      assert.equal(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes("valid email")));
    });

    it("Rejects staff creation with empty name", () => {
      const validation = validateStaffInput({
        fullName: "",
        email: "test@justicenow.org",
        role: "case_officer",
      });

      assert.equal(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes("Full name is required")));
    });

    it("AC 4: Prevents duplicate email addresses (case-insensitive)", async () => {
      const result = await createStaffAccount({
        fullName: "Duplicate User",
        email: "OFFICER.SILVA@JUSTICENOW.ORG", // Existing email in upper case
        role: "case_officer",
      });

      assert.equal(result.success, false);
      assert.ok(
        result.error?.includes("already registered") ||
          result.error?.includes("Duplicate")
      );
    });

    it("AC 6: Prevents admin self-deactivation", () => {
      const adminStaff = INITIAL_STAFF_ACCOUNTS.find((s) => s.id === "staff_admin_01")!;
      const check = canDeactivateStaff(adminStaff, "staff_admin_01");

      assert.equal(check.allowed, false);
      assert.ok(check.reason?.includes("cannot deactivate your own"));
    });
  });

  describe("Subtask JN-195 & AC 3: Account Activation & Deactivation", () => {
    it("Admin can deactivate an active staff account", async () => {
      const result = await toggleStaffActive("staff_officer_01", false, "admin@justicenow.org", "Temporary leave");

      assert.equal(result.success, true);
      assert.equal(result.staff?.isActive, false);
      assert.equal(result.staff?.status, "inactive");

      // Verify from list
      const staff = await getStaffAccountById("staff_officer_01");
      assert.equal(staff?.isActive, false);
    });

    it("Admin can reactivate a deactivated staff account", async () => {
      const result = await toggleStaffActive("staff_officer_inactive", true, "admin@justicenow.org", "Reinstatement");

      assert.equal(result.success, true);
      assert.equal(result.staff?.isActive, true);
      assert.equal(result.staff?.status, "active");
    });
  });

  describe("Subtask JN-228 & AC 5: Deactivated Users Cannot Log In", () => {
    it("Rejects post-login redirect for deactivated staff account", () => {
      const deactivatedOfficer = {
        id: "staff_officer_inactive",
        email: "former.officer@justicenow.org",
        role: "case_officer" as const,
        is_active: false,
        status: "inactive" as const,
      };

      assert.equal(isAccountActive(deactivatedOfficer), false);

      const redirect = resolvePostLoginRedirect(deactivatedOfficer);
      assert.equal(redirect.allowed, false);
      assert.equal(redirect.reason, "inactive_account");
      assert.ok(redirect.error?.includes("inactive"));
      assert.ok(redirect.targetRoute.includes("/unauthorized"));
    });
  });

  describe("Subtask JN-197 & AC 7: Administrative Audit Events", () => {
    it("Emits and records audit event on staff account creation", async () => {
      await createStaffAccount(
        {
          fullName: "Audited Staff",
          email: "audited.staff@justicenow.org",
          role: "evidence_checker",
        },
        "admin@justicenow.org"
      );

      const logs = await getStaffAuditLogs();
      const creationLog = logs.find((l) => l.targetStaffEmail === "audited.staff@justicenow.org");

      assert.ok(creationLog, "Audit log should exist for staff creation");
      assert.equal(creationLog.eventType, "STAFF_ACCOUNT_CREATED");
      assert.equal(creationLog.actorEmail, "admin@justicenow.org");
      assert.ok(creationLog.description.includes("Created new staff account"));
      assert.ok(creationLog.timestamp);
    });

    it("Emits and records audit event on staff deactivation", async () => {
      await toggleStaffActive("staff_officer_02", false, "admin@justicenow.org", "Policy violation");

      const logs = await getStaffAuditLogs();
      const deactivationLog = logs.find(
        (l) => l.targetStaffId === "staff_officer_02" && l.eventType === "STAFF_ACCOUNT_DEACTIVATED"
      );

      assert.ok(deactivationLog, "Audit log should exist for staff deactivation");
      assert.equal(deactivationLog.eventType, "STAFF_ACCOUNT_DEACTIVATED");
      assert.ok(deactivationLog.description.includes("Deactivated staff account"));
      assert.equal(deactivationLog.details?.reason, "Policy violation");
    });
  });
});
