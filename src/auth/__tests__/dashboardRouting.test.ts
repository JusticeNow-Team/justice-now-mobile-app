import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDashboardRouteForRole,
  getRoleForDashboardRoute,
  isAccountActive,
  isRoleAuthorizedForPath,
  PUBLIC_AUTH_ROUTES,
  resolvePostLoginRedirect,
  ROLE_DASHBOARD_ROUTES,
  SystemRole,
} from "../index";

describe("Jira Task JN-177: Route Users to Role-Based Dashboards", () => {
  describe("Subtask JN-178: Define Role-Dashboard Routes", () => {
    it("AC 1: Reporter is mapped to the Reporter dashboard route (/reporter)", () => {
      assert.equal(ROLE_DASHBOARD_ROUTES.reporter, "/reporter");
      assert.equal(getDashboardRouteForRole("reporter"), "/reporter");
      assert.equal(getRoleForDashboardRoute("/reporter"), "reporter");
      assert.equal(getRoleForDashboardRoute("/reporter/cases"), "reporter");
    });

    it("AC 2: Case Officer is mapped to the Case Officer dashboard route (/officer)", () => {
      assert.equal(ROLE_DASHBOARD_ROUTES.case_officer, "/officer");
      assert.equal(getDashboardRouteForRole("case_officer"), "/officer");
      assert.equal(getRoleForDashboardRoute("/officer"), "case_officer");
      assert.equal(getRoleForDashboardRoute("/officer/evidence"), "case_officer");
    });

    it("AC 3: Evidence Checker is mapped to the Evidence Checker dashboard route (/checker)", () => {
      assert.equal(ROLE_DASHBOARD_ROUTES.evidence_checker, "/checker");
      assert.equal(getDashboardRouteForRole("evidence_checker"), "/checker");
      assert.equal(getDashboardRouteForRole("evidence_validator"), "/checker");
      assert.equal(getRoleForDashboardRoute("/checker"), "evidence_checker");
      assert.equal(getRoleForDashboardRoute("/checker/evidence/123"), "evidence_checker");
    });

    it("AC 4: System Admin is mapped to the Admin dashboard route (/admin)", () => {
      assert.equal(ROLE_DASHBOARD_ROUTES.system_admin, "/admin");
      assert.equal(getDashboardRouteForRole("system_admin"), "/admin");
      assert.equal(getRoleForDashboardRoute("/admin"), "system_admin");
      assert.equal(getRoleForDashboardRoute("/admin/roles"), "system_admin");
      assert.equal(getRoleForDashboardRoute("/admin/categories"), "system_admin");
    });
  });

  describe("Subtask JN-179 & AC 5: Manual Cross-Role Dashboard Navigation is Blocked", () => {
    it("Reporter cannot manually access Officer, Checker, or Admin dashboards", () => {
      assert.equal(isRoleAuthorizedForPath("reporter", "/reporter"), true);
      assert.equal(isRoleAuthorizedForPath("reporter", "/officer"), false);
      assert.equal(isRoleAuthorizedForPath("reporter", "/checker"), false);
      assert.equal(isRoleAuthorizedForPath("reporter", "/admin"), false);
      assert.equal(isRoleAuthorizedForPath("reporter", "/admin/roles"), false);
      assert.equal(isRoleAuthorizedForPath("reporter", "/admin/categories"), false);
    });

    it("Case Officer cannot manually access Reporter, Checker, or Admin dashboards", () => {
      assert.equal(isRoleAuthorizedForPath("case_officer", "/officer"), true);
      assert.equal(isRoleAuthorizedForPath("case_officer", "/reporter"), false);
      assert.equal(isRoleAuthorizedForPath("case_officer", "/checker"), false);
      assert.equal(isRoleAuthorizedForPath("case_officer", "/admin"), false);
    });

    it("Evidence Checker cannot manually access Reporter, Officer, or Admin dashboards", () => {
      assert.equal(isRoleAuthorizedForPath("evidence_checker", "/checker"), true);
      assert.equal(isRoleAuthorizedForPath("evidence_validator", "/checker"), true);
      assert.equal(isRoleAuthorizedForPath("evidence_checker", "/reporter"), false);
      assert.equal(isRoleAuthorizedForPath("evidence_checker", "/officer"), false);
      assert.equal(isRoleAuthorizedForPath("evidence_checker", "/admin"), false);
    });

    it("System Admin cannot manually access non-admin module workspaces", () => {
      assert.equal(isRoleAuthorizedForPath("system_admin", "/admin"), true);
      assert.equal(isRoleAuthorizedForPath("system_admin", "/admin/categories"), true);
      assert.equal(isRoleAuthorizedForPath("system_admin", "/reporter"), false);
      assert.equal(isRoleAuthorizedForPath("system_admin", "/officer"), false);
      assert.equal(isRoleAuthorizedForPath("system_admin", "/checker"), false);
    });

    it("Public and authentication routes are always accessible to all users", () => {
      for (const route of PUBLIC_AUTH_ROUTES) {
        assert.equal(isRoleAuthorizedForPath(null, route), true, `Route ${route} should be accessible to unauthenticated users`);
        assert.equal(isRoleAuthorizedForPath("reporter", route), true, `Route ${route} should be accessible to reporter`);
      }
    });
  });

  describe("Subtask JN-180: Post-Login Redirection", () => {
    it("Resolves post-login redirect for Reporter to /reporter", () => {
      const res = resolvePostLoginRedirect("reporter");
      assert.equal(res.allowed, true);
      assert.equal(res.targetRoute, "/reporter");
      assert.equal(res.role, "reporter");
    });

    it("Resolves post-login redirect for Case Officer to /officer", () => {
      const res = resolvePostLoginRedirect("case_officer");
      assert.equal(res.allowed, true);
      assert.equal(res.targetRoute, "/officer");
      assert.equal(res.role, "case_officer");
    });

    it("Resolves post-login redirect for Evidence Checker to /checker", () => {
      const res = resolvePostLoginRedirect("evidence_checker");
      assert.equal(res.allowed, true);
      assert.equal(res.targetRoute, "/checker");
      assert.equal(res.role, "evidence_checker");
    });

    it("Resolves post-login redirect for System Admin to /admin", () => {
      const res = resolvePostLoginRedirect("system_admin");
      assert.equal(res.allowed, true);
      assert.equal(res.targetRoute, "/admin");
      assert.equal(res.role, "system_admin");
    });

    it("Resolves post-login redirect from UserProfile object", () => {
      const profile = {
        id: "usr_123",
        role: "system_admin" as SystemRole,
        full_name: "Admin User",
        is_active: true,
      };
      const res = resolvePostLoginRedirect(profile);
      assert.equal(res.allowed, true);
      assert.equal(res.targetRoute, "/admin");
    });
  });

  describe("Subtask JN-182 & AC 6: Inactive & Unknown Role Handling", () => {
    it("Rejects post-login redirect for unknown or null roles with error", () => {
      const nullRes = resolvePostLoginRedirect(null);
      assert.equal(nullRes.allowed, false);
      assert.equal(nullRes.reason, "invalid_role");
      assert.ok(nullRes.error);

      const invalidRes = resolvePostLoginRedirect("unknown_role_xyz");
      assert.equal(invalidRes.allowed, false);
      assert.equal(invalidRes.reason, "invalid_role");
      assert.ok(invalidRes.error?.includes("Unknown or invalid user role"));
    });

    it("Rejects post-login redirect when account is explicitly marked inactive", () => {
      const inactiveProfile = {
        id: "usr_inactive_1",
        role: "case_officer" as SystemRole,
        is_active: false,
      };

      assert.equal(isAccountActive(inactiveProfile), false);

      const res = resolvePostLoginRedirect(inactiveProfile);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "inactive_account");
      assert.ok(res.error?.includes("inactive"));
      assert.ok(res.targetRoute.includes("/unauthorized"));
    });

    it("Rejects post-login redirect when account status is suspended", () => {
      const suspendedProfile = {
        id: "usr_suspended_1",
        role: "reporter" as SystemRole,
        status: "suspended" as const,
      };

      assert.equal(isAccountActive(suspendedProfile), false);

      const res = resolvePostLoginRedirect(suspendedProfile);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "inactive_account");
    });
  });

  describe("Acceptance Criteria 7: Logout Returns to Public Login", () => {
    it("Unauthenticated state redirects to /login", () => {
      const res = resolvePostLoginRedirect(null);
      assert.equal(res.allowed, false);
      assert.equal(res.targetRoute, "/login");
    });

    it("Public login route is universally accessible without authorization", () => {
      assert.equal(isRoleAuthorizedForPath(null, "/login"), true);
      assert.equal(isRoleAuthorizedForPath(null, "/secure-role"), true);
      assert.equal(isRoleAuthorizedForPath(null, "/unauthorized"), true);
    });
  });
});
