import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPermission,
  assertRole,
  AuthorizationError,
  canAccessRoute,
} from "../middleware";

describe("Subtask JN-132 & JN-133: Route and Action Authorization Middleware", () => {
  describe("Route Access Control (canAccessRoute)", () => {
    it("should allow public and auth routes for all users", () => {
      assert.equal(canAccessRoute(null, "/"), true);
      assert.equal(canAccessRoute(null, "/login"), true);
      assert.equal(canAccessRoute(null, "/register"), true);
      assert.equal(canAccessRoute(null, "/secure-role"), true);
      assert.equal(canAccessRoute(null, "/two-factor"), true);
    });

    it("should allow Reporter to access /reporter routes but block /officer, /checker, /admin", () => {
      assert.equal(canAccessRoute("reporter", "/reporter"), true);
      assert.equal(canAccessRoute("reporter", "/reporter/cases"), true);
      assert.equal(canAccessRoute("reporter", "/officer"), false);
      assert.equal(canAccessRoute("reporter", "/checker"), false);
      assert.equal(canAccessRoute("reporter", "/admin"), false);
    });

    it("should allow Case Officer to access /officer routes but block /checker, /admin", () => {
      assert.equal(canAccessRoute("case_officer", "/officer"), true);
      assert.equal(canAccessRoute("case_officer", "/officer/cases"), true);
      assert.equal(canAccessRoute("case_officer", "/reporter"), false);
      assert.equal(canAccessRoute("case_officer", "/checker"), false);
      assert.equal(canAccessRoute("case_officer", "/admin"), false);
    });

    it("should allow Evidence Checker to access /checker routes but block /officer, /admin", () => {
      assert.equal(canAccessRoute("evidence_checker", "/checker"), true);
      assert.equal(canAccessRoute("evidence_validator", "/checker"), true);
      assert.equal(canAccessRoute("evidence_checker", "/officer"), false);
      assert.equal(canAccessRoute("evidence_checker", "/admin"), false);
    });

    it("should allow System Admin to access /admin routes", () => {
      assert.equal(canAccessRoute("system_admin", "/admin"), true);
      assert.equal(canAccessRoute("system_admin", "/admin/roles"), true);
    });

    it("should block unauthenticated or null roles from protected routes", () => {
      assert.equal(canAccessRoute(null, "/reporter"), false);
      assert.equal(canAccessRoute(null, "/officer"), false);
      assert.equal(canAccessRoute(null, "/checker"), false);
      assert.equal(canAccessRoute(null, "/admin"), false);
    });
  });

  describe("assertRole", () => {
    it("should not throw when role matches expected role", () => {
      assert.doesNotThrow(() => {
        assertRole("case_officer", "case_officer");
      });
      assert.doesNotThrow(() => {
        assertRole("system_admin", ["case_officer", "system_admin"]);
      });
      assert.doesNotThrow(() => {
        assertRole("evidence_validator", "evidence_checker");
      });
    });

    it("should throw AuthorizationError when role does not match", () => {
      assert.throws(
        () => {
          assertRole("reporter", "system_admin");
        },
        (err: unknown) => {
          return (
            err instanceof AuthorizationError &&
            err.message.includes("is not authorized")
          );
        }
      );
    });
  });

  describe("assertPermission", () => {
    it("should not throw when role has required permission", () => {
      assert.doesNotThrow(() => {
        assertPermission("reporter", "cases:create");
      });
      assert.doesNotThrow(() => {
        assertPermission("system_admin", "admin:roles:manage");
      });
    });

    it("should throw AuthorizationError when role lacks required permission", () => {
      assert.throws(
        () => {
          assertPermission("reporter", "admin:system:configure");
        },
        (err: unknown) => {
          return (
            err instanceof AuthorizationError &&
            err.message.includes("lacks the required permission")
          );
        }
      );
    });
  });
});
