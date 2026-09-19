import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  getPaginatedAuditEvents,
  recordAuditEvent,
  sanitizeAuditDetails,
  requireAdministrator,
  getEventCategory,
  resetAuditStoreForTesting,
} from "../index";

describe("Sprint 3 Task: View Administrative Audit Logs (JN-280 to JN-285)", () => {
  beforeEach(() => {
    resetAuditStoreForTesting();
  });

  // ==========================================================================
  // JN-284: Apply Admin-only Access (AC 1 & AC 6)
  // ==========================================================================
  describe("JN-284 & AC 1: Administrative Authorization Guard", () => {
    it("AC 1: Authorized System Admin can retrieve audit entries", async () => {
      const response = await getPaginatedAuditEvents({}, "system_admin");
      assert.ok(response);
      assert.ok(Array.isArray(response.events));
      assert.ok(response.totalCount > 0, "Initial mock seeds should provide audit entries");
      assert.ok(response.events.length > 0);
    });

    it("AC 1: Rejects unauthorized Case Officer with descriptive error", async () => {
      await assert.rejects(
        async () => {
          await getPaginatedAuditEvents({}, "case_officer");
        },
        /Unauthorized.*Only System Administrators/i,
      );
    });

    it("AC 1: Rejects unauthorized Evidence Checker with descriptive error", async () => {
      await assert.rejects(
        async () => {
          await getPaginatedAuditEvents({}, "evidence_checker");
        },
        /Unauthorized.*Only System Administrators/i,
      );
    });

    it("AC 1: Rejects unauthorized Reporter with descriptive error", async () => {
      await assert.rejects(
        async () => {
          await getPaginatedAuditEvents({}, "reporter");
        },
        /Unauthorized.*Only System Administrators/i,
      );
    });

    it("AC 1: Rejects undefined / anonymous role with descriptive error", async () => {
      await assert.rejects(
        async () => {
          await getPaginatedAuditEvents({}, undefined);
        },
        /Unauthorized.*Only System Administrators/i,
      );
    });

    it("AC 1: requireAdministrator helper validates system_admin strictly", () => {
      assert.doesNotThrow(() => requireAdministrator("system_admin"));
      assert.throws(() => requireAdministrator("case_officer"), /Unauthorized/);
      assert.throws(() => requireAdministrator("evidence_checker"), /Unauthorized/);
      assert.throws(() => requireAdministrator("reporter"), /Unauthorized/);
      assert.throws(() => requireAdministrator(undefined), /Unauthorized/);
    });
  });

  // ==========================================================================
  // JN-281: Audit-log Interface & Attribution Fields (AC 2)
  // ==========================================================================
  describe("JN-281 & AC 2: Entry Attribution & Data Structure", () => {
    it("AC 2: Entries contain actor email, actor role, action, target email, and timestamp", async () => {
      const recorded = await recordAuditEvent({
        eventType: "STATUS_CONFIG_CREATED",
        actorEmail: "admin@justicenow.org",
        actorRole: "system_admin",
        targetEmail: "system:status_registry",
        action: "STATUS_CONFIG_CREATE",
        description: "Created approved case status: Formal Investigation",
        details: { statusCode: "formal_investigation", entityType: "case" },
      });

      assert.ok(recorded.id);
      assert.equal(recorded.actorEmail, "admin@justicenow.org");
      assert.equal(recorded.actorRole, "system_admin");
      assert.equal(recorded.targetEmail, "system:status_registry");
      assert.equal(recorded.action, "STATUS_CONFIG_CREATE");
      assert.ok(recorded.timestamp);
      assert.ok(!Number.isNaN(Date.parse(recorded.timestamp)), "Timestamp must be valid ISO 8601 string");

      const response = await getPaginatedAuditEvents({ searchQuery: "Formal Investigation" }, "system_admin");
      const found = response.events.find((e) => e.id === recorded.id);
      assert.ok(found, "Newly recorded event should be queryable by admin");
      assert.equal(found?.actorEmail, "admin@justicenow.org");
      assert.equal(found?.actorRole, "system_admin");
      assert.equal(found?.targetEmail, "system:status_registry");
      assert.equal(found?.action, "STATUS_CONFIG_CREATE");
      assert.ok(found?.timestamp);
    });

    it("AC 2: Includes optional IP address and user agent if provided", async () => {
      const recorded = await recordAuditEvent({
        eventType: "LOGIN_SUCCESS",
        actorEmail: "admin@justicenow.org",
        actorRole: "system_admin",
        targetEmail: "admin@justicenow.org",
        action: "STAFF_LOGIN_SUCCESS",
        description: "Admin logged into administrative portal",
        ipAddress: "192.168.1.105",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      });

      assert.equal(recorded.ipAddress, "192.168.1.105");
      assert.equal(recorded.userAgent, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    });
  });

  // ==========================================================================
  // JN-280: Audit-log Query & Multi-Category Coverage (AC 4 & AC 6)
  // ==========================================================================
  describe("JN-280 & AC 4 & AC 6: Multi-Category Event Inclusion & Read-Only Immutability", () => {
    it("AC 4: Audit system includes Account, Role, Case, Evidence, Status, and Security events", async () => {
      const response = await getPaginatedAuditEvents({ pageSize: 100 }, "system_admin");
      const events = response.events;

      const categoriesPresent = new Set(events.map((e) => e.category || getEventCategory(e.eventType)));

      assert.ok(categoriesPresent.has("account"), "Must include Account events");
      assert.ok(categoriesPresent.has("role"), "Must include Role events");
      assert.ok(categoriesPresent.has("case"), "Must include Case events");
      assert.ok(categoriesPresent.has("evidence"), "Must include Evidence events");
      assert.ok(categoriesPresent.has("status"), "Must include Status configuration events");
      assert.ok(categoriesPresent.has("security"), "Must include Security events");
    });

    it("AC 4: Correctly maps specific event types to their respective categories", () => {
      assert.equal(getEventCategory("ACCOUNT_CREATED"), "account");
      assert.equal(getEventCategory("LOGIN_FAILED"), "account");
      assert.equal(getEventCategory("ROLE_ASSIGNED"), "role");
      assert.equal(getEventCategory("ROLE_CHANGED"), "role");
      assert.equal(getEventCategory("CASE_CREATED"), "case");
      assert.equal(getEventCategory("CASE_WITHDRAWAL_REVIEWED"), "case");
      assert.equal(getEventCategory("EVIDENCE_VERIFIED"), "evidence");
      assert.equal(getEventCategory("EVIDENCE_CLARIFICATION_REQUESTED"), "evidence");
      assert.equal(getEventCategory("STATUS_CONFIG_CREATED"), "status");
      assert.equal(getEventCategory("CHECKER_AVAILABILITY_CHANGED"), "status");
      assert.equal(getEventCategory("SECURITY_POLICY_VIOLATION"), "security");
      assert.equal(getEventCategory("UNAUTHORIZED_ACCESS_ATTEMPT"), "security");
    });

    it("AC 6: Audit service does not provide update or delete methods (Append-only / Read-only)", async () => {
      const auditModule = await import("../auditService");
      assert.equal(typeof (auditModule as any).updateAuditEvent, "undefined", "No update function should exist");
      assert.equal(typeof (auditModule as any).deleteAuditEvent, "undefined", "No delete function should exist");
      assert.equal(typeof (auditModule as any).removeAuditEvent, "undefined", "No remove function should exist");
    });
  });

  // ==========================================================================
  // JN-282: Filter Audit Logs (AC 3)
  // ==========================================================================
  describe("JN-282 & AC 3: Filter by User, Action, Category, Result, and Search", () => {
    it("AC 3: Filters audit logs by category", async () => {
      const caseLogs = await getPaginatedAuditEvents({ category: "case" }, "system_admin");
      assert.ok(caseLogs.events.length > 0);
      assert.ok(caseLogs.events.every((e) => (e.category || getEventCategory(e.eventType)) === "case"));

      const evidenceLogs = await getPaginatedAuditEvents({ category: "evidence" }, "system_admin");
      assert.ok(evidenceLogs.events.length > 0);
      assert.ok(evidenceLogs.events.every((e) => (e.category || getEventCategory(e.eventType)) === "evidence"));

      const roleLogs = await getPaginatedAuditEvents({ category: "role" }, "system_admin");
      assert.ok(roleLogs.events.length > 0);
      assert.ok(roleLogs.events.every((e) => (e.category || getEventCategory(e.eventType)) === "role"));
    });

    it("AC 3: Filters audit logs by actor or target email", async () => {
      const userLogs = await getPaginatedAuditEvents(
        { actorEmail: "admin@justicenow.org" },
        "system_admin",
      );
      assert.ok(userLogs.events.length > 0);
      assert.ok(
        userLogs.events.every(
          (e) =>
            e.actorEmail.toLowerCase().includes("admin@justicenow.org") ||
            e.targetEmail.toLowerCase().includes("admin@justicenow.org"),
        ),
      );
    });

    it("AC 3: Filters audit logs by specific event type", async () => {
      const loginFails = await getPaginatedAuditEvents(
        { eventType: "LOGIN_FAILED" },
        "system_admin",
      );
      assert.ok(loginFails.events.length > 0);
      assert.ok(loginFails.events.every((e) => e.eventType === "LOGIN_FAILED"));
    });

    it("AC 3: Filters audit logs by result status (success vs failure)", async () => {
      const failureLogs = await getPaginatedAuditEvents(
        { result: "failure" },
        "system_admin",
      );
      assert.ok(failureLogs.events.length > 0);
      assert.ok(
        failureLogs.events.every(
          (e) =>
            e.eventType.includes("FAILED") ||
            e.eventType.includes("UNAUTHORIZED") ||
            e.eventType.includes("VIOLATION") ||
            e.eventType.includes("REJECTED") ||
            e.action.includes("FAIL"),
        ),
      );

      const successLogs = await getPaginatedAuditEvents(
        { result: "success" },
        "system_admin",
      );
      assert.ok(successLogs.events.length > 0);
      assert.ok(
        successLogs.events.every(
          (e) =>
            !e.eventType.includes("FAILED") &&
            !e.eventType.includes("UNAUTHORIZED") &&
            !e.eventType.includes("VIOLATION") &&
            !e.eventType.includes("REJECTED") &&
            !e.action.includes("FAIL"),
        ),
      );
    });

    it("AC 3: Filters audit logs by free-text search across actor, target, action, description", async () => {
      const searchRes = await getPaginatedAuditEvents(
        { searchQuery: "forensic" },
        "system_admin",
      );
      assert.ok(searchRes.events.length > 0);
      for (const event of searchRes.events) {
        const fullContent = `${event.actorEmail} ${event.targetEmail} ${event.action} ${event.description} ${JSON.stringify(
          event.details,
        )}`.toLowerCase();
        assert.ok(
          fullContent.includes("forensic"),
          `Result must contain search query term "forensic": ${event.description}`,
        );
      }
    });
  });

  // ==========================================================================
  // JN-283: Pagination Controls (AC 7)
  // ==========================================================================
  describe("JN-283 & AC 7: Pagination Controls and Slicing", () => {
    it("AC 7: Paginated response contains page, pageSize, totalPages, totalCount", async () => {
      const res = await getPaginatedAuditEvents({ page: 1, pageSize: 5 }, "system_admin");
      assert.equal(res.page, 1);
      assert.equal(res.pageSize, 5);
      assert.equal(res.events.length, 5);
      assert.ok(res.totalCount >= 20);
      assert.equal(res.totalPages, Math.ceil(res.totalCount / 5));
    });

    it("AC 7: Navigating to page 2 returns distinct next slice of records", async () => {
      const page1 = await getPaginatedAuditEvents({ page: 1, pageSize: 5 }, "system_admin");
      const page2 = await getPaginatedAuditEvents({ page: 2, pageSize: 5 }, "system_admin");

      assert.equal(page1.events.length, 5);
      assert.equal(page2.events.length, 5);

      const page1Ids = new Set(page1.events.map((e) => e.id));
      for (const item of page2.events) {
        assert.ok(!page1Ids.has(item.id), `Page 2 item ${item.id} should not be in Page 1`);
      }
    });

    it("AC 7: Handles custom page sizes (10, 25, 50)", async () => {
      const res10 = await getPaginatedAuditEvents({ page: 1, pageSize: 10 }, "system_admin");
      assert.equal(res10.events.length, 10);
      assert.equal(res10.pageSize, 10);

      const res25 = await getPaginatedAuditEvents({ page: 1, pageSize: 25 }, "system_admin");
      assert.equal(res25.pageSize, 25);
      assert.equal(res25.events.length, Math.min(25, res25.totalCount));
    });

    it("AC 7: Gracefully handles out-of-range page requests", async () => {
      const res = await getPaginatedAuditEvents({ page: 999, pageSize: 10 }, "system_admin");
      assert.equal(res.events.length, 0);
      assert.ok(res.totalCount > 0);
      assert.equal(res.page, 999);
    });
  });

  // ==========================================================================
  // JN-285: Test Sensitive-Data Exclusion (AC 5)
  // ==========================================================================
  describe("JN-285 & AC 5: Sensitive Credential Exclusion & Deep Redaction", () => {
    it("AC 5: Deeply redacts passwords, tokens, API keys, PINs, OTPs, auth headers in details", () => {
      const rawDetails = {
        username: "investigator.silva",
        password: "ClearTextPassword123!",
        confirmPassword: "ClearTextPassword123!",
        pin: "9876",
        otpCode: "654321",
        sessionToken: "eyJhbGciOiJIUzI1NiIsIn...",
        apiKey: "sk-live-9923847293847",
        secret: "super-duper-secret",
        authorization: "Bearer eyJhbGciOi...",
        nested: {
          refreshToken: "dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4=",
          hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          safeNote: "Account password changed by self-service",
        },
      };

      const sanitized = sanitizeAuditDetails(rawDetails);

      assert.equal(sanitized.password, "[REDACTED]");
      assert.equal(sanitized.confirmPassword, "[REDACTED]");
      assert.equal(sanitized.pin, "[REDACTED]");
      assert.equal(sanitized.otpCode, "[REDACTED]");
      assert.equal(sanitized.sessionToken, "[REDACTED]");
      assert.equal(sanitized.apiKey, "[REDACTED]");
      assert.equal(sanitized.secret, "[REDACTED]");
      assert.equal(sanitized.authorization, "[REDACTED]");
      assert.equal(sanitized.nested.refreshToken, "[REDACTED]");
      assert.equal(sanitized.nested.hash, "[REDACTED]");
      assert.equal(sanitized.nested.safeNote, "Account password changed by self-service");
      assert.equal(sanitized.username, "investigator.silva");
    });

    it("AC 5: Recording an audit event automatically sanitizes all sensitive fields before storage", async () => {
      const logged = await recordAuditEvent({
        eventType: "SIGN_IN_ATTEMPT",
        actorEmail: "intruder@suspicious.org",
        targetEmail: "admin@justicenow.org",
        action: "STAFF_AUTH_ATTEMPT",
        description: "Failed login with credentials",
        details: {
          attemptedPassword: "HackedPassword99!",
          rawToken: "malicious_token_48293",
          clientIp: "45.33.32.156",
        },
      });

      assert.equal(logged.details.attemptedPassword, "[REDACTED]");
      assert.equal(logged.details.rawToken, "[REDACTED]");
      assert.equal(logged.details.clientIp, "45.33.32.156");

      // Verify retrieved event has redacted data
      const fetched = await getPaginatedAuditEvents({ searchQuery: "intruder@suspicious.org" }, "system_admin");
      const target = fetched.events.find((e) => e.id === logged.id);
      assert.ok(target);
      assert.equal(target?.details.attemptedPassword, "[REDACTED]");
      assert.equal(target?.details.rawToken, "[REDACTED]");
    });
  });
});
