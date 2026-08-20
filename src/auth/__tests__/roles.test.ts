import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAllRoles,
  getRoleConfig,
  getStaffRoles,
  isValidRole,
  normalizeRole,
  ROLE_CONFIGS,
  SYSTEM_ROLES,
} from "../roles";

describe("Subtask JN-129 & JN-130: Role Model and Seed Configuration", () => {
  it("should have exactly the 4 required JusticeNow system roles configured", () => {
    assert.equal(SYSTEM_ROLES.REPORTER, "reporter");
    assert.equal(SYSTEM_ROLES.CASE_OFFICER, "case_officer");
    assert.equal(SYSTEM_ROLES.EVIDENCE_CHECKER, "evidence_checker");
    assert.equal(SYSTEM_ROLES.SYSTEM_ADMIN, "system_admin");

    const allRoles = getAllRoles();
    assert.equal(allRoles.length, 4);
  });

  it("should configure Reporter role correctly", () => {
    const config = getRoleConfig("reporter");
    assert.ok(config);
    assert.equal(config.id, "reporter");
    assert.equal(config.name, "Reporter");
    assert.equal(config.isStaff, false);
    assert.equal(config.defaultRoute, "/reporter");
    assert.ok(config.permissions.includes("cases:create"));
    assert.ok(config.permissions.includes("cases:read:own"));
    assert.ok(config.permissions.includes("evidence:upload:own"));
  });

  it("should configure Case Officer role correctly", () => {
    const config = getRoleConfig("case_officer");
    assert.ok(config);
    assert.equal(config.id, "case_officer");
    assert.equal(config.name, "Case Officer");
    assert.equal(config.isStaff, true);
    assert.equal(config.defaultRoute, "/officer");
    assert.ok(config.permissions.includes("cases:read:assigned"));
    assert.ok(config.permissions.includes("cases:update:status"));
    assert.ok(config.permissions.includes("evidence:assign"));
  });

  it("should configure Evidence Checker role correctly", () => {
    const config = getRoleConfig("evidence_checker");
    assert.ok(config);
    assert.equal(config.id, "evidence_checker");
    assert.equal(config.name, "Evidence Checker");
    assert.equal(config.isStaff, true);
    assert.equal(config.defaultRoute, "/checker");
    assert.ok(config.permissions.includes("evidence:validate"));
    assert.ok(config.permissions.includes("evidence:read:all"));
  });

  it("should configure System Admin role correctly", () => {
    const config = getRoleConfig("system_admin");
    assert.ok(config);
    assert.equal(config.id, "system_admin");
    assert.equal(config.name, "System Admin");
    assert.equal(config.isStaff, true);
    assert.equal(config.defaultRoute, "/admin");
    assert.ok(config.permissions.includes("admin:roles:manage"));
    assert.ok(config.permissions.includes("admin:users:manage"));
    assert.ok(config.permissions.includes("admin:system:configure"));
    assert.ok(config.permissions.includes("cases:delete"));
  });

  it("should normalize role names and handle legacy aliases", () => {
    assert.equal(normalizeRole("evidence_validator"), "evidence_checker");
    assert.equal(normalizeRole("EVIDENCE_CHECKER"), "evidence_checker");
    assert.equal(normalizeRole("CASE_OFFICER"), "case_officer");
    assert.equal(normalizeRole("REPORTER"), "reporter");
    assert.equal(normalizeRole("SYSTEM_ADMIN"), "system_admin");
    assert.equal(normalizeRole("unknown_role"), null);
    assert.equal(normalizeRole(null), null);
    assert.equal(normalizeRole(undefined), null);
  });

  it("should validate recognized system roles", () => {
    assert.equal(isValidRole("reporter"), true);
    assert.equal(isValidRole("case_officer"), true);
    assert.equal(isValidRole("evidence_checker"), true);
    assert.equal(isValidRole("evidence_validator"), true);
    assert.equal(isValidRole("system_admin"), true);
    assert.equal(isValidRole("guest"), false);
    assert.equal(isValidRole(""), false);
  });

  it("should filter staff roles correctly", () => {
    const staffRoles = getStaffRoles();
    assert.equal(staffRoles.length, 3);
    const staffIds = staffRoles.map((r) => r.id);
    assert.ok(staffIds.includes("case_officer"));
    assert.ok(staffIds.includes("evidence_checker"));
    assert.ok(staffIds.includes("system_admin"));
    assert.equal(staffIds.includes("reporter"), false);
  });
});
