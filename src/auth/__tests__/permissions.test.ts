import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPermissionsForRole,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  PERMISSIONS,
} from "../permissions";

describe("Subtask JN-131: Permission Rules and Matrix Checks", () => {
  describe("Reporter Permissions", () => {
    it("should allow Reporter to create cases and upload own evidence", () => {
      assert.equal(hasPermission("reporter", PERMISSIONS.CASES_CREATE), true);
      assert.equal(hasPermission("reporter", PERMISSIONS.CASES_READ_OWN), true);
      assert.equal(
        hasPermission("reporter", PERMISSIONS.EVIDENCE_UPLOAD_OWN),
        true
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.EVIDENCE_READ_OWN),
        true
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.PROFILE_READ_OWN),
        true
      );
    });

    it("should block Reporter from executing staff or admin operations", () => {
      assert.equal(
        hasPermission("reporter", PERMISSIONS.CASES_UPDATE_STATUS),
        false
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.CASES_REQUEST_INFO),
        false
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.EVIDENCE_VALIDATE),
        false
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.EVIDENCE_ASSIGN),
        false
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.ADMIN_USERS_MANAGE),
        false
      );
      assert.equal(
        hasPermission("reporter", PERMISSIONS.ADMIN_SYSTEM_CONFIGURE),
        false
      );
    });
  });

  describe("Case Officer Permissions", () => {
    it("should allow Case Officer to manage assigned cases and assign evidence", () => {
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.CASES_READ_ASSIGNED),
        true
      );
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.CASES_UPDATE_STATUS),
        true
      );
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.CASES_REQUEST_INFO),
        true
      );
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.EVIDENCE_ASSIGN),
        true
      );
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.EVIDENCE_READ_ALL),
        true
      );
    });

    it("should block Case Officer from administrator-only settings", () => {
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.ADMIN_ROLES_MANAGE),
        false
      );
      assert.equal(
        hasPermission("case_officer", PERMISSIONS.ADMIN_SYSTEM_CONFIGURE),
        false
      );
      assert.equal(hasPermission("case_officer", PERMISSIONS.CASES_DELETE), false);
    });
  });

  describe("Evidence Checker Permissions", () => {
    it("should allow Evidence Checker to validate evidence files", () => {
      assert.equal(
        hasPermission("evidence_checker", PERMISSIONS.EVIDENCE_VALIDATE),
        true
      );
      assert.equal(
        hasPermission("evidence_checker", PERMISSIONS.EVIDENCE_READ_ALL),
        true
      );
      assert.equal(
        hasPermission("evidence_checker", PERMISSIONS.CASES_READ_ASSIGNED),
        true
      );
    });

    it("should support legacy alias evidence_validator with same permissions", () => {
      assert.equal(
        hasPermission("evidence_validator", PERMISSIONS.EVIDENCE_VALIDATE),
        true
      );
    });

    it("should block Evidence Checker from updating case status or configuring system", () => {
      assert.equal(
        hasPermission("evidence_checker", PERMISSIONS.CASES_UPDATE_STATUS),
        false
      );
      assert.equal(
        hasPermission("evidence_checker", PERMISSIONS.ADMIN_USERS_MANAGE),
        false
      );
    });
  });

  describe("System Admin Permissions", () => {
    it("should grant full administrative, role, user, and security capabilities", () => {
      assert.equal(
        hasPermission("system_admin", PERMISSIONS.ADMIN_USERS_MANAGE),
        true
      );
      assert.equal(
        hasPermission("system_admin", PERMISSIONS.ADMIN_ROLES_MANAGE),
        true
      );
      assert.equal(
        hasPermission("system_admin", PERMISSIONS.ADMIN_AUDIT_LOGS_READ),
        true
      );
      assert.equal(
        hasPermission("system_admin", PERMISSIONS.ADMIN_SYSTEM_CONFIGURE),
        true
      );
      assert.equal(
        hasPermission("system_admin", PERMISSIONS.CASES_DELETE),
        true
      );
    });
  });

  describe("Helper Functions", () => {
    it("hasAnyPermission should return true if any permission is granted", () => {
      assert.equal(
        hasAnyPermission("reporter", [
          PERMISSIONS.ADMIN_USERS_MANAGE,
          PERMISSIONS.CASES_CREATE,
        ]),
        true
      );
      assert.equal(
        hasAnyPermission("reporter", [
          PERMISSIONS.ADMIN_USERS_MANAGE,
          PERMISSIONS.ADMIN_ROLES_MANAGE,
        ]),
        false
      );
    });

    it("hasAllPermissions should return true only if all permissions are granted", () => {
      assert.equal(
        hasAllPermissions("reporter", [
          PERMISSIONS.CASES_CREATE,
          PERMISSIONS.CASES_READ_OWN,
        ]),
        true
      );
      assert.equal(
        hasAllPermissions("reporter", [
          PERMISSIONS.CASES_CREATE,
          PERMISSIONS.ADMIN_USERS_MANAGE,
        ]),
        false
      );
    });

    it("getPermissionsForRole should return empty array for invalid roles", () => {
      assert.deepEqual(getPermissionsForRole(null), []);
      assert.deepEqual(getPermissionsForRole("unknown"), []);
    });
  });
});
