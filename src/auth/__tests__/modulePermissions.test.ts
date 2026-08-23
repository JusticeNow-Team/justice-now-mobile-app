import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAdminOperationAllowed,
  assertBackendAction,
  assertCaseManagementUpdateAllowed,
  authorizeBackendAction,
  canAccessRoute,
  formatUnauthorizedReason,
  isModuleAccessPermitted,
  isModuleActionPermitted,
  logSecurityIncident,
  MODULE_PERMISSION_MATRIX,
} from "../index";

describe("Jira Task JN-244: Enforce Module-Level Permissions", () => {
  describe("Subtask JN-245: Permission Matrix Definitions", () => {
    it("Validates that all 4 modules have distinct action definitions", () => {
      assert.ok(MODULE_PERMISSION_MATRIX["report:submit"]);
      assert.ok(MODULE_PERMISSION_MATRIX["case:update_status"]);
      assert.ok(MODULE_PERMISSION_MATRIX["evidence:validate"]);
      assert.ok(MODULE_PERMISSION_MATRIX["admin:staff_manage"]);
    });

    it("Checks module workspace access permissions", () => {
      assert.equal(isModuleAccessPermitted("reporter", "reporter_module"), true);
      assert.equal(isModuleAccessPermitted("reporter", "case_officer_module"), false);
      assert.equal(isModuleAccessPermitted("reporter", "evidence_checker_module"), false);
      assert.equal(isModuleAccessPermitted("reporter", "system_admin_module"), false);

      assert.equal(isModuleAccessPermitted("case_officer", "case_officer_module"), true);
      assert.equal(isModuleAccessPermitted("case_officer", "system_admin_module"), false);

      assert.equal(isModuleAccessPermitted("evidence_checker", "evidence_checker_module"), true);
      assert.equal(isModuleAccessPermitted("evidence_checker", "case_officer_module"), false);

      assert.equal(isModuleAccessPermitted("system_admin", "system_admin_module"), true);
    });
  });

  describe("Subtask JN-246 & AC 1: Reporter Cannot Access Staff Modules / APIs", () => {
    it("Rejects Reporter from executing Case Officer actions", () => {
      const result = authorizeBackendAction("reporter", "case:update_status");
      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 403);
      assert.ok(result.error?.includes("not authorized"));
    });

    it("Rejects Reporter from executing Evidence Checker actions", () => {
      const result = authorizeBackendAction("reporter", "evidence:validate");
      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 403);
    });

    it("Rejects Reporter from executing Admin actions", () => {
      const result = authorizeBackendAction("reporter", "admin:staff_manage");
      assert.equal(result.authorized, false);
      assert.equal(result.statusCode, 403);
    });
  });

  describe("Subtask JN-246 & AC 2: Case Officer Cannot Access System Admin Operations", () => {
    it("Rejects Case Officer from executing staff management or role assignment", () => {
      assert.throws(() => {
        assertAdminOperationAllowed("case_officer", "admin:staff_manage");
      }, /prohibited from executing System Administration/);

      assert.throws(() => {
        assertAdminOperationAllowed("case_officer", "admin:role_assign");
      }, /prohibited from executing System Administration/);
    });
  });

  describe("Subtask JN-246 & AC 3: Evidence Checker Cannot Update Case-Management Fields", () => {
    it("Rejects Evidence Checker when attempting to update case management status", () => {
      assert.throws(() => {
        assertCaseManagementUpdateAllowed("evidence_checker");
      }, /Evidence Checkers are prohibited from updating case-management fields/);
    });

    it("Allows Case Officer to update case management status", () => {
      assert.doesNotThrow(() => {
        assertCaseManagementUpdateAllowed("case_officer");
      });
    });
  });

  describe("Subtask JN-246 & AC 4: System Admin Access is Limited to Administration", () => {
    it("System Admin can execute admin operations", () => {
      const result = authorizeBackendAction("system_admin", "admin:staff_manage");
      assert.equal(result.authorized, true);
      assert.equal(result.statusCode, 200);
    });

    it("System Admin is not authorized as an evidence checker", () => {
      assert.equal(isModuleActionPermitted("system_admin", "evidence:validate"), false);
    });
  });

  describe("Subtask JN-247 & AC 5: Direct URL Access is Protected by Route Guards", () => {
    it("Protects direct navigation to /admin from non-admin roles", () => {
      assert.equal(canAccessRoute("reporter", "/admin"), false);
      assert.equal(canAccessRoute("case_officer", "/admin"), false);
      assert.equal(canAccessRoute("evidence_checker", "/admin"), false);
      assert.equal(canAccessRoute("system_admin", "/admin"), true);
    });

    it("Protects direct navigation to /officer from non-officer roles", () => {
      assert.equal(canAccessRoute("reporter", "/officer"), false);
      assert.equal(canAccessRoute("evidence_checker", "/officer"), false);
      assert.equal(canAccessRoute("case_officer", "/officer"), true);
    });

    it("Protects direct navigation to /checker from non-checker roles", () => {
      assert.equal(canAccessRoute("reporter", "/checker"), false);
      assert.equal(canAccessRoute("case_officer", "/checker"), false);
      assert.equal(canAccessRoute("evidence_checker", "/checker"), true);
    });
  });

  describe("Subtask JN-246 & AC 6: API Access is Protected Independently of UI", () => {
    it("assertBackendAction throws 403 AuthorizationError on unauthorized direct service call", () => {
      assert.throws(() => {
        assertBackendAction("reporter", "admin:role_assign");
      }, /Access denied|Forbidden/);
    });

    it("assertBackendAction throws 401 when no session exists", () => {
      assert.throws(() => {
        assertBackendAction(null, "case:update_status");
      }, /Authentication required/);
    });

    it("Protects personal reporter resources from access by other reporters", () => {
      const res = authorizeBackendAction(
        "reporter",
        "report:view_own",
        "reporter_owner_1",
        "reporter_intruder_2"
      );
      assert.equal(res.authorized, false);
      assert.equal(res.statusCode, 403);
      assert.ok(res.error?.includes("another reporter"));
    });
  });

  describe("Subtask JN-248 & AC 7: Unauthorized Response Handling & Security Logging", () => {
    it("Formats contextual unauthorized reasons accurately", () => {
      const staffRestricted = formatUnauthorizedReason("reporter_staff_access");
      assert.ok(staffRestricted.title.includes("Staff Area Restricted"));

      const adminRestricted = formatUnauthorizedReason("officer_admin_access");
      assert.ok(adminRestricted.title.includes("Administrator Access Required"));

      const checkerRestricted = formatUnauthorizedReason("checker_case_management");
      assert.ok(checkerRestricted.title.includes("Case Management Restricted"));
    });

    it("Logs security incidents with metadata and timestamp", () => {
      const incident = logSecurityIncident({
        actorRole: "reporter",
        attemptedPathOrAction: "/admin/roles",
        reason: "Direct URL access blocked",
        statusCode: 403,
      });

      assert.ok(incident.id);
      assert.equal(incident.actorRole, "reporter");
      assert.equal(incident.attemptedPathOrAction, "/admin/roles");
      assert.equal(incident.statusCode, 403);
      assert.ok(incident.timestamp);
    });
  });
});
