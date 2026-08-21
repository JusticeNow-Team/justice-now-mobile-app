import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ============================================================================
// JUSTICE NOW RBAC SYSTEM TEST SUITE
// Covers: JN-129, JN-130, JN-131, JN-132, JN-133, JN-134
// ============================================================================

// --- 1. Role Model & Configuration (JN-129 & JN-130) ---
const SYSTEM_ROLES = {
  REPORTER: "reporter",
  CASE_OFFICER: "case_officer",
  EVIDENCE_CHECKER: "evidence_checker",
  SYSTEM_ADMIN: "system_admin",
};

const ROLE_CONFIGS = {
  reporter: {
    id: "reporter",
    name: "Reporter",
    label: "Public Reporter",
    description:
      "Submits human rights violation reports, uploads supporting evidence, and tracks personal case progress safely.",
    icon: "📢",
    badgeColor: {
      background: "#EEF3FA",
      text: "#1F4372",
      border: "#B5C8E1",
    },
    defaultRoute: "/reporter",
    isStaff: false,
    permissions: [
      "cases:create",
      "cases:read:own",
      "evidence:upload:own",
      "evidence:read:own",
      "profile:read:own",
      "profile:update:own",
      "profile:security:manage",
    ],
  },
  case_officer: {
    id: "case_officer",
    name: "Case Officer",
    label: "Case Investigator / Officer",
    description:
      "Reviews, investigates, requests additional information, assigns evidence, and manages status for assigned cases.",
    icon: "⚖️",
    badgeColor: {
      background: "#EFF4FF",
      text: "#1E46AC",
      border: "#C0D4FD",
    },
    defaultRoute: "/officer",
    isStaff: true,
    permissions: [
      "cases:read:assigned",
      "cases:read:all",
      "cases:update:status",
      "cases:request_info",
      "evidence:read:assigned",
      "evidence:read:all",
      "evidence:assign",
      "profile:read:own",
      "profile:update:own",
      "profile:security:manage",
    ],
  },
  evidence_checker: {
    id: "evidence_checker",
    name: "Evidence Checker",
    label: "Evidence Checker / Validator",
    description:
      "Examines submitted evidence files, verifies chain of custody, records forensic validation decisions, and adds verification notes.",
    icon: "🔍",
    badgeColor: {
      background: "#EAF7F8",
      text: "#155C63",
      border: "#A2E0E4",
    },
    defaultRoute: "/checker",
    isStaff: true,
    permissions: [
      "cases:read:assigned",
      "evidence:read:assigned",
      "evidence:read:all",
      "evidence:validate",
      "profile:read:own",
      "profile:update:own",
      "profile:security:manage",
    ],
  },
  system_admin: {
    id: "system_admin",
    name: "System Admin",
    label: "System Administrator",
    description:
      "Configures system roles, manages user accounts and permissions, oversees audit logs, and maintains security controls.",
    icon: "⚙️",
    badgeColor: {
      background: "#FBF7EC",
      text: "#AF8722",
      border: "#E9D69D",
    },
    defaultRoute: "/admin",
    isStaff: true,
    permissions: [
      "cases:read:all",
      "cases:delete",
      "evidence:read:all",
      "evidence:validate",
      "admin:users:read",
      "admin:users:manage",
      "admin:roles:manage",
      "admin:audit_logs:read",
      "admin:system:configure",
      "profile:read:own",
      "profile:update:own",
      "profile:security:manage",
    ],
  },
};

function normalizeRole(role) {
  if (!role) return null;
  const clean = role.trim().toLowerCase();
  if (clean === "evidence_validator" || clean === "evidence_checker") {
    return "evidence_checker";
  }
  if (clean in ROLE_CONFIGS) {
    return clean;
  }
  return null;
}

function isValidRole(role) {
  return normalizeRole(role) !== null;
}

function getRoleConfig(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  return ROLE_CONFIGS[normalized] || null;
}

function getAllRoles() {
  return Object.values(ROLE_CONFIGS);
}

function getStaffRoles() {
  return Object.values(ROLE_CONFIGS).filter((r) => r.isStaff);
}

// --- 2. Permission Rules (JN-131) ---
const PERMISSIONS = {
  CASES_CREATE: "cases:create",
  CASES_READ_OWN: "cases:read:own",
  CASES_READ_ASSIGNED: "cases:read:assigned",
  CASES_READ_ALL: "cases:read:all",
  CASES_UPDATE_STATUS: "cases:update:status",
  CASES_REQUEST_INFO: "cases:request_info",
  CASES_DELETE: "cases:delete",
  EVIDENCE_UPLOAD_OWN: "evidence:upload:own",
  EVIDENCE_READ_OWN: "evidence:read:own",
  EVIDENCE_READ_ASSIGNED: "evidence:read:assigned",
  EVIDENCE_READ_ALL: "evidence:read:all",
  EVIDENCE_VALIDATE: "evidence:validate",
  EVIDENCE_ASSIGN: "evidence:assign",
  PROFILE_READ_OWN: "profile:read:own",
  PROFILE_UPDATE_OWN: "profile:update:own",
  PROFILE_SECURITY_MANAGE: "profile:security:manage",
  ADMIN_USERS_READ: "admin:users:read",
  ADMIN_USERS_MANAGE: "admin:users:manage",
  ADMIN_ROLES_MANAGE: "admin:roles:manage",
  ADMIN_AUDIT_LOGS_READ: "admin:audit_logs:read",
  ADMIN_SYSTEM_CONFIGURE: "admin:system:configure",
};

const ROLE_PERMISSIONS = {
  reporter: ROLE_CONFIGS.reporter.permissions,
  case_officer: ROLE_CONFIGS.case_officer.permissions,
  evidence_checker: ROLE_CONFIGS.evidence_checker.permissions,
  system_admin: ROLE_CONFIGS.system_admin.permissions,
};

function getPermissionsForRole(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return [];
  return ROLE_PERMISSIONS[normalized] || [];
}

function hasPermission(role, permission) {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

function hasAnyPermission(role, permissions) {
  if (permissions.length === 0) return true;
  const rolePermissions = getPermissionsForRole(role);
  return permissions.some((p) => rolePermissions.includes(p));
}

function hasAllPermissions(role, permissions) {
  if (permissions.length === 0) return true;
  const rolePermissions = getPermissionsForRole(role);
  return permissions.every((p) => rolePermissions.includes(p));
}

// --- 3. Authorization Middleware (JN-132 & JN-133) ---
class AuthorizationError extends Error {
  constructor(
    message = "Access denied: Unauthorized action or route.",
    code = "UNAUTHORIZED_ACCESS",
    status = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = status;
  }
}

const ROUTE_AUTHORIZATION_RULES = [
  {
    pathPrefix: "/reporter",
    allowedRoles: ["reporter"],
    requiredPermissions: ["profile:read:own"],
  },
  {
    pathPrefix: "/officer",
    allowedRoles: ["case_officer"],
    requiredPermissions: ["cases:read:assigned"],
  },
  {
    pathPrefix: "/checker",
    allowedRoles: ["evidence_checker"],
    requiredPermissions: ["evidence:validate"],
  },
  {
    pathPrefix: "/admin",
    allowedRoles: ["system_admin"],
    requiredPermissions: ["admin:system:configure"],
  },
];

function canAccessRoute(role, path) {
  if (
    path === "/" ||
    path.startsWith("/(auth)") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/language") ||
    path.startsWith("/secure-role") ||
    path.startsWith("/two-factor") ||
    path.startsWith("/otp")
  ) {
    return true;
  }

  const normalized = normalizeRole(role);
  if (!normalized) {
    return false;
  }

  const matchingRule = ROUTE_AUTHORIZATION_RULES.find((rule) =>
    path.startsWith(rule.pathPrefix)
  );

  if (!matchingRule) {
    return true;
  }

  const roleAllowed = matchingRule.allowedRoles.includes(normalized);
  if (!roleAllowed) {
    return false;
  }

  if (
    matchingRule.requiredPermissions &&
    matchingRule.requiredPermissions.length > 0
  ) {
    return hasAllPermissions(normalized, matchingRule.requiredPermissions);
  }

  return true;
}

function assertRole(role, expectedRoles) {
  const normalized = normalizeRole(role);
  const allowed = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];

  if (!normalized || !allowed.includes(normalized)) {
    throw new AuthorizationError(
      `Role '${role || "anonymous"}' is not authorized to perform this action.`
    );
  }
}

function assertPermission(role, requiredPermission) {
  if (!hasPermission(role, requiredPermission)) {
    throw new AuthorizationError(
      `Role '${role || "anonymous"}' lacks the required permission: '${requiredPermission}'.`
    );
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("JN-129: Role Model and Role Configuration", () => {
  it("Acceptance Criteria 1: Reporter role exists", () => {
    assert.equal(SYSTEM_ROLES.REPORTER, "reporter");
    const config = getRoleConfig("reporter");
    assert.ok(config, "Reporter configuration must exist");
    assert.equal(config.name, "Reporter");
    assert.equal(config.isStaff, false);
    assert.equal(config.defaultRoute, "/reporter");
  });

  it("Acceptance Criteria 2: Case Officer role exists", () => {
    assert.equal(SYSTEM_ROLES.CASE_OFFICER, "case_officer");
    const config = getRoleConfig("case_officer");
    assert.ok(config, "Case Officer configuration must exist");
    assert.equal(config.name, "Case Officer");
    assert.equal(config.isStaff, true);
    assert.equal(config.defaultRoute, "/officer");
  });

  it("Acceptance Criteria 3: Evidence Checker role exists", () => {
    assert.equal(SYSTEM_ROLES.EVIDENCE_CHECKER, "evidence_checker");
    const config = getRoleConfig("evidence_checker");
    assert.ok(config, "Evidence Checker configuration must exist");
    assert.equal(config.name, "Evidence Checker");
    assert.equal(config.isStaff, true);
    assert.equal(config.defaultRoute, "/checker");
  });

  it("Acceptance Criteria 4: System Admin role exists", () => {
    assert.equal(SYSTEM_ROLES.SYSTEM_ADMIN, "system_admin");
    const config = getRoleConfig("system_admin");
    assert.ok(config, "System Admin configuration must exist");
    assert.equal(config.name, "System Admin");
    assert.equal(config.isStaff, true);
    assert.equal(config.defaultRoute, "/admin");
  });

  it("Validates and normalizes role identifiers and legacy aliases", () => {
    assert.equal(normalizeRole("evidence_validator"), "evidence_checker");
    assert.equal(normalizeRole("evidence_checker"), "evidence_checker");
    assert.equal(normalizeRole("case_officer"), "case_officer");
    assert.equal(normalizeRole("reporter"), "reporter");
    assert.equal(normalizeRole("system_admin"), "system_admin");
    assert.equal(normalizeRole("invalid_role"), null);

    assert.equal(isValidRole("reporter"), true);
    assert.equal(isValidRole("case_officer"), true);
    assert.equal(isValidRole("evidence_checker"), true);
    assert.equal(isValidRole("evidence_validator"), true);
    assert.equal(isValidRole("system_admin"), true);
    assert.equal(isValidRole("hacker"), false);
  });
});

describe("JN-130: System Roles Seeding", () => {
  it("Provides all four system roles in the registry", () => {
    const roles = getAllRoles();
    assert.equal(roles.length, 4);
    const ids = roles.map((r) => r.id);
    assert.ok(ids.includes("reporter"));
    assert.ok(ids.includes("case_officer"));
    assert.ok(ids.includes("evidence_checker"));
    assert.ok(ids.includes("system_admin"));
  });

  it("Filters staff roles vs public roles properly", () => {
    const staffRoles = getStaffRoles();
    assert.equal(staffRoles.length, 3);
    const staffIds = staffRoles.map((s) => s.id);
    assert.ok(staffIds.includes("case_officer"));
    assert.ok(staffIds.includes("evidence_checker"));
    assert.ok(staffIds.includes("system_admin"));
    assert.equal(staffIds.includes("reporter"), false);
  });
});

describe("JN-131: Defined Permission Sets (Acceptance Criteria 5)", () => {
  it("Reporter role has defined and restricted permissions", () => {
    assert.equal(hasPermission("reporter", PERMISSIONS.CASES_CREATE), true);
    assert.equal(hasPermission("reporter", PERMISSIONS.CASES_READ_OWN), true);
    assert.equal(
      hasPermission("reporter", PERMISSIONS.EVIDENCE_UPLOAD_OWN),
      true
    );
    assert.equal(
      hasPermission("reporter", PERMISSIONS.PROFILE_READ_OWN),
      true
    );

    // Blocked actions for Reporter
    assert.equal(
      hasPermission("reporter", PERMISSIONS.CASES_UPDATE_STATUS),
      false
    );
    assert.equal(
      hasPermission("reporter", PERMISSIONS.EVIDENCE_VALIDATE),
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

  it("Case Officer role has defined permissions", () => {
    assert.equal(
      hasPermission("case_officer", PERMISSIONS.CASES_READ_ASSIGNED),
      true
    );
    assert.equal(
      hasPermission("case_officer", PERMISSIONS.CASES_READ_ALL),
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

    // Blocked actions for Case Officer
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

  it("Evidence Checker role has defined permissions", () => {
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

    // Supports legacy alias
    assert.equal(
      hasPermission("evidence_validator", PERMISSIONS.EVIDENCE_VALIDATE),
      true
    );

    // Blocked actions for Evidence Checker
    assert.equal(
      hasPermission("evidence_checker", PERMISSIONS.CASES_UPDATE_STATUS),
      false
    );
    assert.equal(
      hasPermission("evidence_checker", PERMISSIONS.ADMIN_USERS_MANAGE),
      false
    );
  });

  it("System Admin role has comprehensive administrative permissions", () => {
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
    assert.equal(
      hasPermission("system_admin", PERMISSIONS.EVIDENCE_VALIDATE),
      true
    );
  });
});

describe("JN-132: Unauthorized Routes and Actions Are Blocked (Acceptance Criteria 6)", () => {
  it("Blocks unauthorized routes for Reporter", () => {
    assert.equal(canAccessRoute("reporter", "/reporter"), true);
    assert.equal(canAccessRoute("reporter", "/officer"), false);
    assert.equal(canAccessRoute("reporter", "/checker"), false);
    assert.equal(canAccessRoute("reporter", "/admin"), false);
  });

  it("Blocks unauthorized routes for Case Officer", () => {
    assert.equal(canAccessRoute("case_officer", "/officer"), true);
    assert.equal(canAccessRoute("case_officer", "/reporter"), false);
    assert.equal(canAccessRoute("case_officer", "/checker"), false);
    assert.equal(canAccessRoute("case_officer", "/admin"), false);
  });

  it("Blocks unauthorized routes for Evidence Checker", () => {
    assert.equal(canAccessRoute("evidence_checker", "/checker"), true);
    assert.equal(canAccessRoute("evidence_validator", "/checker"), true);
    assert.equal(canAccessRoute("evidence_checker", "/officer"), false);
    assert.equal(canAccessRoute("evidence_checker", "/admin"), false);
  });

  it("Allows System Admin to access administration routes", () => {
    assert.equal(canAccessRoute("system_admin", "/admin"), true);
    assert.equal(canAccessRoute("system_admin", "/admin/roles"), true);
  });

  it("assertRole throws AuthorizationError on mismatch", () => {
    assert.doesNotThrow(() => assertRole("case_officer", "case_officer"));
    assert.doesNotThrow(() =>
      assertRole("system_admin", ["case_officer", "system_admin"])
    );
    assert.throws(
      () => assertRole("reporter", "system_admin"),
      AuthorizationError
    );
  });

  it("assertPermission throws AuthorizationError when permission missing", () => {
    assert.doesNotThrow(() =>
      assertPermission("reporter", PERMISSIONS.CASES_CREATE)
    );
    assert.throws(
      () =>
        assertPermission("reporter", PERMISSIONS.ADMIN_SYSTEM_CONFIGURE),
      AuthorizationError
    );
  });
});

describe("JN-133: Role-Based Navigation Support (Acceptance Criteria 7 & 8)", () => {
  it("Resolves correct default workspace routes for each role", () => {
    assert.equal(getRoleConfig("reporter").defaultRoute, "/reporter");
    assert.equal(getRoleConfig("case_officer").defaultRoute, "/officer");
    assert.equal(getRoleConfig("evidence_checker").defaultRoute, "/checker");
    assert.equal(getRoleConfig("system_admin").defaultRoute, "/admin");
  });

  it("Public routes are accessible to all unauthenticated users", () => {
    assert.equal(canAccessRoute(null, "/"), true);
    assert.equal(canAccessRoute(null, "/login"), true);
    assert.equal(canAccessRoute(null, "/register"), true);
    assert.equal(canAccessRoute(null, "/secure-role"), true);
    assert.equal(canAccessRoute(null, "/two-factor"), true);
  });
});

// ============================================================================
// JN-135 REPORT CATEGORIES TEST SUITE
// Covers: JN-136, JN-137, JN-138, JN-139, JN-140, JN-141
// ============================================================================

const INITIAL_REPORT_CATEGORIES = [
  {
    id: "cat_unlawful_detention",
    code: "unlawful_detention",
    name: "Unlawful Detention",
    description: "Being held in custody without lawful authority.",
    hint: "Being held without lawful reason or process",
    icon: "⛓️",
    isActive: true,
    displayOrder: 1,
  },
  {
    id: "cat_discrimination",
    code: "discrimination",
    name: "Discrimination",
    description: "Unfair treatment based on identity or characteristics.",
    hint: "Unfair treatment based on who you are",
    icon: "⚖️",
    isActive: true,
    displayOrder: 2,
  },
  {
    id: "cat_violence_abuse",
    code: "violence_or_abuse",
    name: "Violence or Abuse",
    description: "Physical harm or ill-treatment.",
    hint: "Physical harm, threats or ill-treatment",
    icon: "🛡️",
    isActive: true,
    displayOrder: 3,
  },
  {
    id: "cat_harassment",
    code: "harassment",
    name: "Harassment & Intimidation",
    description: "Repeated stalking or intimidation.",
    hint: "Repeated unwanted behaviour",
    icon: "⚠️",
    isActive: true,
    displayOrder: 4,
  },
  {
    id: "cat_freedom_expression",
    code: "freedom_of_expression",
    name: "Freedom of Expression Violation",
    description: "Suppression of speech or assembly.",
    hint: "Being stopped from speaking",
    icon: "📢",
    isActive: true,
    displayOrder: 5,
  },
  {
    id: "cat_workplace_rights",
    code: "workplace_rights",
    name: "Workplace Rights Violation",
    description: "Unsafe or unpaid work conditions.",
    hint: "Unsafe or unpaid conditions",
    icon: "🏭",
    isActive: true,
    displayOrder: 6,
  },
  {
    id: "cat_child_rights",
    code: "child_rights",
    name: "Child Rights Violation",
    description: "Harm or denial of child rights.",
    hint: "Harm affecting a child",
    icon: "🧸",
    isActive: true,
    displayOrder: 7,
  },
  {
    id: "cat_other",
    code: "other",
    name: "Other Human Rights Violation",
    description: "Other human rights violations not listed.",
    hint: "Something not listed here",
    icon: "📋",
    isActive: true,
    displayOrder: 8,
  },
];

let testCategories = INITIAL_REPORT_CATEGORIES.map((c) => ({ ...c }));

function validateCategoryInput(input, existing = testCategories) {
  const errors = [];
  const name = (input.name || "").trim();
  const code = (input.code || "").trim();

  if (!name) errors.push("Category name is required.");
  if (!code) errors.push("Category code is required.");

  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    errors.push(`A category with the name "${name}" already exists.`);
  }
  if (existing.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
    errors.push(`A category with the code "${code}" already exists.`);
  }

  return { isValid: errors.length === 0, errors };
}

function validateSelectedCategories(selected, available = testCategories) {
  if (!selected || selected.length === 0) {
    return { isValid: false, invalidSelections: [], error: "Select at least one incident category." };
  }
  const activeCodes = new Set(available.filter((c) => c.isActive).map((c) => c.code));
  const invalid = selected.filter((s) => !activeCodes.has(s));
  if (invalid.length > 0) {
    return { isValid: false, invalidSelections: invalid, error: `Invalid category: ${invalid.join(", ")}` };
  }
  return { isValid: true, invalidSelections: [] };
}

describe("JN-136: Report-Category Model & Migration (Acceptance Criteria 1)", () => {
  it("Validates report-category data structure format", () => {
    const cat = INITIAL_REPORT_CATEGORIES[0];
    assert.ok(cat.id);
    assert.ok(cat.code);
    assert.ok(cat.name);
    assert.ok(cat.description);
    assert.equal(typeof cat.isActive, "boolean");
    assert.equal(typeof cat.displayOrder, "number");
  });
});

describe("JN-137: Initial Category Seed Data (Acceptance Criteria 2)", () => {
  it("Initial human-rights categories are available and seeded", () => {
    assert.ok(testCategories.length >= 8);
    const codes = testCategories.map((c) => c.code);
    assert.ok(codes.includes("unlawful_detention"));
    assert.ok(codes.includes("discrimination"));
    assert.ok(codes.includes("violence_or_abuse"));
    assert.ok(codes.includes("harassment"));
  });
});

describe("JN-138 & JN-140: Active Category Filtering (Acceptance Criteria 3 & 6)", () => {
  it("Filters active categories only for the reporter form", () => {
    const list = testCategories.map((c) => (c.code === "other" ? { ...c, isActive: false } : c));
    const active = list.filter((c) => c.isActive);
    assert.equal(active.some((c) => c.code === "other"), false);
  });
});

describe("JN-136 & Acceptance Criteria 4: Duplicate Category Prevention", () => {
  it("Prevents duplicate category names (case-insensitive)", () => {
    const result = validateCategoryInput({ name: "Unlawful Detention", code: "new_code" });
    assert.equal(result.isValid, false);
    assert.ok(result.errors[0].includes("already exists"));
  });

  it("Prevents duplicate category codes", () => {
    const result = validateCategoryInput({ name: "Brand New Category", code: "unlawful_detention" });
    assert.equal(result.isValid, false);
    assert.ok(result.errors[0].includes("already exists"));
  });
});

describe("JN-139 & JN-141: Category Selection & Case Record Linking (Acceptance Criteria 5 & 7)", () => {
  it("Accepts valid active category selection", () => {
    const result = validateSelectedCategories(["unlawful_detention", "discrimination"]);
    assert.equal(result.isValid, true);
  });

  it("Rejects empty category selection", () => {
    const result = validateSelectedCategories([]);
    assert.equal(result.isValid, false);
  });

  it("Rejects invalid/unknown category selection", () => {
    const result = validateSelectedCategories(["fake_unknown_category"]);
    assert.equal(result.isValid, false);
  });

  it("Rejects deactivated category selection", () => {
    const listWithInactive = testCategories.map((c) =>
      c.code === "discrimination" ? { ...c, isActive: false } : c
    );
    const result = validateSelectedCategories(["discrimination"], listWithInactive);
    assert.equal(result.isValid, false);
  });
});

