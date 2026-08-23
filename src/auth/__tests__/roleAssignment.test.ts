import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPermissionDiff,
  getPermissionsForRole,
  isValidSystemRole,
  updateUserRole,
  validateRoleAssignment,
} from "../index";

describe("Jira Task JN-230: Assign and Update System Roles", () => {
  describe("Subtask JN-238 & AC 1: View Current Roles and Capabilities", () => {
    it("Admin can inspect current role permissions", () => {
      const officerPerms = getPermissionsForRole("case_officer");
      assert.ok(officerPerms.includes("report:read:all"));
      assert.ok(officerPerms.includes("report:update"));
      assert.ok(!officerPerms.includes("admin:roles:update"));

      const adminPerms = getPermissionsForRole("system_admin");
      assert.ok(adminPerms.includes("admin:roles:update"));
      assert.ok(adminPerms.includes("admin:users:manage"));
    });
  });

  describe("Subtask JN-239 & AC 2: Assign Valid Role", () => {
    it("System Admin can assign a valid role to a staff member", async () => {
      const result = await updateUserRole({
        actorRole: "system_admin",
        actorUserId: "admin_001",
        actorUserEmail: "admin@justicenow.org",
        targetUserId: "officer_101",
        targetUserEmail: "officer.silva@justicenow.org",
        targetCurrentRole: "case_officer",
        newRole: "evidence_checker",
        reason: "Promoted to Evidence Verification Lead",
      });

      assert.equal(result.success, true);
      assert.equal(result.newRole, "evidence_checker");
      assert.ok(result.auditLog);
      assert.equal(result.auditLog.previousRole, "case_officer");
      assert.equal(result.auditLog.newRole, "evidence_checker");
      assert.equal(result.auditLog.actorEmail, "admin@justicenow.org");
    });
  });

  describe("Subtask JN-240 & AC 4 & AC 6: Role Validation & Security Guardrails", () => {
    it("AC 4: Rejects invalid or unsupported role assignments", async () => {
      assert.equal(isValidSystemRole("super_god_mode"), false);
      assert.equal(isValidSystemRole(""), false);
      assert.equal(isValidSystemRole("guest_viewer"), false);

      const result = await updateUserRole({
        actorRole: "system_admin",
        actorUserId: "admin_001",
        targetUserId: "user_202",
        targetUserEmail: "user@justicenow.org",
        targetCurrentRole: "reporter",
        newRole: "invalid_super_role",
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Invalid role"));
    });

    it("AC 6: Rejects role updates initiated by non-admin users", async () => {
      const result = await updateUserRole({
        actorRole: "case_officer", // Unauthorized non-admin
        actorUserId: "officer_101",
        targetUserId: "officer_102",
        targetUserEmail: "officer2@justicenow.org",
        targetCurrentRole: "case_officer",
        newRole: "system_admin",
      });

      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Unauthorized"));
    });

    it("AC 6: Prevents active admin self-demotion to avoid administrator lockout", () => {
      const validation = validateRoleAssignment({
        actorRole: "system_admin",
        actorUserId: "admin_master_id",
        targetUserId: "admin_master_id", // Same ID: self demotion
        targetCurrentRole: "system_admin",
        proposedRole: "reporter",
      });

      assert.equal(validation.isValid, false);
      assert.ok(validation.error?.includes("cannot demote your own administrator"));
    });

    it("Rejects no-op assignment to the exact same role", () => {
      const validation = validateRoleAssignment({
        actorRole: "system_admin",
        actorUserId: "admin_1",
        targetUserId: "officer_2",
        targetCurrentRole: "case_officer",
        proposedRole: "case_officer",
      });

      assert.equal(validation.isValid, false);
      assert.ok(validation.error?.includes("already assigned"));
    });
  });

  describe("Subtask JN-241 & JN-242 & AC 5: Live Permission Refresh & Differential", () => {
    it("Calculates exact permissions gained and removed when changing role", () => {
      // Case Officer -> Evidence Checker
      const diff = getPermissionDiff("case_officer", "evidence_checker");

      // Evidence Checker gains evidence:verify
      assert.ok(diff.gained.includes("evidence:verify"));
      // Evidence Checker loses report:update
      assert.ok(diff.removed.includes("report:update"));
      // Both share report:read:all
      assert.ok(diff.unchanged.includes("report:read:all"));
    });

    it("Correctly computes permission diff when promoting to System Admin", () => {
      const diff = getPermissionDiff("reporter", "system_admin");

      assert.ok(diff.gained.includes("admin:roles:update"));
      assert.ok(diff.gained.includes("admin:users:manage"));
      assert.ok(diff.gained.includes("admin:audit_logs:read"));
      assert.equal(diff.removed.length, 0);
    });
  });

  describe("Subtask JN-243 & AC 7: Role Change Audit Trail", () => {
    it("Records full audit trail with metadata and timestamp on role assignment", async () => {
      const result = await updateUserRole({
        actorRole: "system_admin",
        actorUserId: "admin_audit_id",
        actorUserEmail: "chief.admin@justicenow.org",
        targetUserId: "staff_promoted",
        targetUserEmail: "promoted.staff@justicenow.org",
        targetCurrentRole: "reporter",
        newRole: "case_officer",
        reason: "Hired as new junior investigator",
      });

      assert.equal(result.success, true);
      assert.ok(result.auditLog);
      assert.equal(result.auditLog.eventType, "STAFF_ROLE_CHANGED");
      assert.equal(result.auditLog.targetUserEmail, "promoted.staff@justicenow.org");
      assert.equal(result.auditLog.previousRole, "reporter");
      assert.equal(result.auditLog.newRole, "case_officer");
      assert.equal(result.auditLog.reason, "Hired as new junior investigator");
      assert.ok(result.auditLog.timestamp);
    });
  });
});
