import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AuthorizationError } from "../../auth/middleware";
import {
  evaluateEvidenceSecurity,
  evaluateInactiveAccountLockout,
  evaluateOwnershipIsolation,
  evaluateRoleAuthorization,
  evaluateRouteProtection,
  evaluateSecretsAndSanitization,
  getSecurityDefectsLog,
  requireAdministrator,
  runComprehensiveSecurityReview,
} from "../securityReviewService";
import {
  CANONICAL_PROTECTED_ROUTES,
  RESOLVED_SECURITY_DEFECTS,
} from "../types";

describe("Final Security & Access Review - Static Contract Verification (JN-400 to JN-405)", () => {
  it("CANONICAL_PROTECTED_ROUTES defines all 12 protected routes across 5 portals (JN-400)", () => {
    assert.equal(CANONICAL_PROTECTED_ROUTES.length, 12);
    assert.ok(CANONICAL_PROTECTED_ROUTES.every((r) => r.authRequired === true));
    assert.ok(CANONICAL_PROTECTED_ROUTES.some((r) => r.route === "/admin"));
    assert.ok(CANONICAL_PROTECTED_ROUTES.some((r) => r.route === "/admin/security"));
    assert.ok(CANONICAL_PROTECTED_ROUTES.some((r) => r.route === "/officer"));
    assert.ok(CANONICAL_PROTECTED_ROUTES.some((r) => r.route === "/checker"));
    assert.ok(CANONICAL_PROTECTED_ROUTES.some((r) => r.route === "/reporter"));
  });

  it("RESOLVED_SECURITY_DEFECTS defines 6 verified defect mitigations (JN-405, AC 7)", () => {
    assert.equal(RESOLVED_SECURITY_DEFECTS.length, 6);
    assert.ok(RESOLVED_SECURITY_DEFECTS.every((d) => d.resolutionStatus === "VERIFIED"));
    assert.ok(RESOLVED_SECURITY_DEFECTS.some((d) => d.defectId === "SEC-DEF-001"));
    assert.ok(RESOLVED_SECURITY_DEFECTS.some((d) => d.defectId === "SEC-DEF-002"));
    assert.ok(RESOLVED_SECURITY_DEFECTS.some((d) => d.defectId === "SEC-DEF-003"));
    assert.ok(RESOLVED_SECURITY_DEFECTS.some((d) => d.defectId === "SEC-DEF-004"));
    assert.ok(RESOLVED_SECURITY_DEFECTS.some((d) => d.defectId === "SEC-DEF-005"));
    assert.ok(RESOLVED_SECURITY_DEFECTS.some((d) => d.defectId === "SEC-DEF-006"));
  });
});

describe("Final Security & Access Review - Acceptance Criteria Tests (JN-400 to JN-405)", () => {
  it("AC 1 & JN-400: All protected routes require authentication and have active guards", () => {
    const domain = evaluateRouteProtection();
    assert.equal(domain.status, "PASS");
    assert.equal(domain.scorePercentage, 100);
    assert.equal(domain.checksPassed, 3);
    assert.equal(domain.checksTotal, 3);
  });

  it("AC 2 & JN-401: Role permissions and boundaries are strictly enforced across all 4 roles", () => {
    const domain = evaluateRoleAuthorization();
    assert.equal(domain.status, "PASS");
    assert.equal(domain.scorePercentage, 100);
    assert.equal(domain.checksPassed, 4);
    assert.equal(domain.checksTotal, 4);
  });

  it("AC 3 & JN-402: One Reporter cannot access another Reporter's cases or upload evidence (Anti-IDOR)", () => {
    const domain = evaluateOwnershipIsolation();
    assert.equal(domain.status, "PASS");
    assert.equal(domain.scorePercentage, 100);
    assert.equal(domain.checksPassed, 3);
    assert.equal(domain.checksTotal, 3);
  });

  it("AC 4 & JN-403: Evidence is not publicly accessible and requires signed URLs", () => {
    const domain = evaluateEvidenceSecurity();
    assert.equal(domain.status, "PASS");
    assert.equal(domain.scorePercentage, 100);
    assert.equal(domain.checksPassed, 3);
    assert.equal(domain.checksTotal, 3);
  });

  it("AC 5: Inactive and suspended users cannot log in", () => {
    const domain = evaluateInactiveAccountLockout();
    assert.equal(domain.status, "PASS");
    assert.equal(domain.scorePercentage, 100);
    assert.equal(domain.checksPassed, 2);
    assert.equal(domain.checksTotal, 2);
  });

  it("AC 6 & JN-404: Sensitive values are not committed and audit logs deeply redact credentials", () => {
    const domain = evaluateSecretsAndSanitization();
    assert.equal(domain.status, "PASS");
    assert.equal(domain.scorePercentage, 100);
    assert.equal(domain.checksPassed, 3);
    assert.equal(domain.checksTotal, 3);
  });

  it("AC 7 & JN-405: Comprehensive security review produces 100% compliance with 0 open defects", async () => {
    const summary = await runComprehensiveSecurityReview("system_admin", "admin@justicenow.org");
    assert.equal(summary.overallStatus, "PASS");
    assert.equal(summary.complianceScore, 100);
    assert.equal(summary.totalChecks, 18);
    assert.equal(summary.passedChecks, 18);
    assert.equal(summary.failedChecks, 0);
    assert.equal(summary.criticalDefectsOpen, 0);
    assert.equal(summary.domains.length, 6);
    assert.equal(summary.defectLog.length, 6);
  });

  it("AC 6: Security review service strictly enforces requireAdministrator", () => {
    assert.doesNotThrow(() => requireAdministrator("system_admin"));
    assert.doesNotThrow(() => requireAdministrator("SYSTEM_ADMIN"));

    assert.throws(
      () => requireAdministrator("case_officer"),
      (err: unknown) => err instanceof AuthorizationError && err.statusCode === 403,
    );

    assert.throws(
      () => requireAdministrator("evidence_checker"),
      (err: unknown) => err instanceof AuthorizationError && err.statusCode === 403,
    );

    assert.throws(
      () => requireAdministrator("reporter"),
      (err: unknown) => err instanceof AuthorizationError && err.statusCode === 403,
    );

    assert.throws(
      () => getSecurityDefectsLog("case_officer"),
      (err: unknown) => err instanceof AuthorizationError && err.statusCode === 403,
    );
  });
});
