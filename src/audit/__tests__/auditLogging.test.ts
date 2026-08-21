import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAuditEvents,
  recordAuditEvent,
  sanitizeAuditDetails,
} from "../index";

describe("Jira Task JN-252: Record Account and Role Audit Events", () => {
  describe("Subtask JN-253 & AC 4: Audit Event Structure & Attribution", () => {
    it("AC 4: Each event contains actor, action, target, and ISO timestamp", async () => {
      const event = await recordAuditEvent({
        eventType: "ACCOUNT_CREATED",
        actorId: "admin_001",
        actorEmail: "admin@justicenow.org",
        actorRole: "system_admin",
        targetId: "officer_001",
        targetEmail: "officer.silva@justicenow.org",
        action: "STAFF_INVITE",
        description: "Created Case Officer account",
        details: { department: "Human Rights" },
      });

      assert.ok(event.id);
      assert.equal(event.actorEmail, "admin@justicenow.org");
      assert.equal(event.targetEmail, "officer.silva@justicenow.org");
      assert.equal(event.action, "STAFF_INVITE");
      assert.ok(event.timestamp);
      assert.ok(!Number.isNaN(Date.parse(event.timestamp)));
    });
  });

  describe("Subtask JN-255 & AC 1 & AC 2: Account Lifecycle Events Recorded", () => {
    it("AC 1: Account creation is recorded", async () => {
      const event = await recordAuditEvent({
        eventType: "ACCOUNT_CREATED",
        actorEmail: "admin@justicenow.org",
        targetEmail: "new.checker@justicenow.org",
        action: "STAFF_CREATE",
        description: "Invited Evidence Checker Perera",
        details: { role: "evidence_checker" },
      });

      assert.equal(event.eventType, "ACCOUNT_CREATED");
      assert.equal(event.targetEmail, "new.checker@justicenow.org");
    });

    it("AC 2: Account activation and deactivation are recorded", async () => {
      const deactEvent = await recordAuditEvent({
        eventType: "ACCOUNT_DEACTIVATED",
        actorEmail: "admin@justicenow.org",
        targetEmail: "officer.silva@justicenow.org",
        action: "STAFF_DEACTIVATE",
        description: "Deactivated staff account due to suspension",
        details: { previousStatus: "active", newStatus: "inactive" },
      });

      assert.equal(deactEvent.eventType, "ACCOUNT_DEACTIVATED");
      assert.equal(deactEvent.details.newStatus, "inactive");

      const actEvent = await recordAuditEvent({
        eventType: "ACCOUNT_ACTIVATED",
        actorEmail: "admin@justicenow.org",
        targetEmail: "officer.silva@justicenow.org",
        action: "STAFF_ACTIVATE",
        description: "Reactivated staff account",
        details: { previousStatus: "inactive", newStatus: "active" },
      });

      assert.equal(actEvent.eventType, "ACCOUNT_ACTIVATED");
      assert.equal(actEvent.details.newStatus, "active");
    });
  });

  describe("Subtask JN-256 & AC 3: Role Change Events Recorded", () => {
    it("AC 3: Role changes are recorded with previous and new roles", async () => {
      const roleEvent = await recordAuditEvent({
        eventType: "ROLE_CHANGED",
        actorEmail: "admin@justicenow.org",
        targetEmail: "investigator@justicenow.org",
        action: "STAFF_ROLE_CHANGE",
        description: "Promoted Investigator to System Admin",
        details: {
          previousRole: "case_officer",
          newRole: "system_admin",
          gainedPermissions: ["admin:users:manage", "admin:roles:manage"],
        },
      });

      assert.equal(roleEvent.eventType, "ROLE_CHANGED");
      assert.equal(roleEvent.details.previousRole, "case_officer");
      assert.equal(roleEvent.details.newRole, "system_admin");
      assert.ok(roleEvent.details.gainedPermissions.length > 0);
    });
  });

  describe("Subtask JN-254 & AC 6: Sensitive Passwords and Tokens Redaction", () => {
    it("AC 6: Sanitizes and redacts passwords, tokens, pins, and auth headers", () => {
      const rawPayload = {
        fullName: "Test Officer",
        email: "test@justicenow.org",
        password: "SuperSecretPassword123!",
        confirmPassword: "SuperSecretPassword123!",
        accessToken: "jwt_token_abc_123",
        secret: "my_api_secret",
        pin: "1234",
        nested: {
          refreshToken: "refresh_xyz_999",
          normalField: "public_value",
        },
      };

      const sanitized = sanitizeAuditDetails(rawPayload);

      assert.equal(sanitized.password, "[REDACTED]");
      assert.equal(sanitized.confirmPassword, "[REDACTED]");
      assert.equal(sanitized.accessToken, "[REDACTED]");
      assert.equal(sanitized.secret, "[REDACTED]");
      assert.equal(sanitized.pin, "[REDACTED]");
      assert.equal(sanitized.nested.refreshToken, "[REDACTED]");
      assert.equal(sanitized.nested.normalField, "public_value");
      assert.equal(sanitized.fullName, "Test Officer");
    });
  });

  describe("Subtask JN-254 & AC 7: Audit Access Restricted to Authorized Admins", () => {
    it("AC 7: Allows System Admin to view audit records", async () => {
      const logs = await getAuditEvents(undefined, "system_admin");
      assert.ok(Array.isArray(logs));
      assert.ok(logs.length > 0);
    });

    it("AC 7: Rejects Case Officer from accessing audit records", async () => {
      await assert.rejects(async () => {
        await getAuditEvents(undefined, "case_officer");
      }, /Unauthorized.*Only System Administrators/);
    });

    it("AC 7: Rejects Evidence Checker from accessing audit records", async () => {
      await assert.rejects(async () => {
        await getAuditEvents(undefined, "evidence_checker");
      }, /Unauthorized.*Only System Administrators/);
    });

    it("AC 7: Rejects Reporter from accessing audit records", async () => {
      await assert.rejects(async () => {
        await getAuditEvents(undefined, "reporter");
      }, /Unauthorized.*Only System Administrators/);
    });
  });
});
