import { RoleMetadata, SystemRole } from "./types";

export const SYSTEM_ROLES = {
  REPORTER: "reporter" as const,
  CASE_OFFICER: "case_officer" as const,
  EVIDENCE_CHECKER: "evidence_checker" as const,
  SYSTEM_ADMIN: "system_admin" as const,
};

export const ROLE_CONFIGS: Record<SystemRole, RoleMetadata> = {
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

/**
 * Normalizes legacy role names (e.g. 'evidence_validator') to the canonical SystemRole.
 */
export function normalizeRole(role: string | null | undefined): SystemRole | null {
  if (!role) return null;
  const clean = role.trim().toLowerCase();
  if (clean === "evidence_validator" || clean === "evidence_checker") {
    return "evidence_checker";
  }
  if (clean in ROLE_CONFIGS) {
    return clean as SystemRole;
  }
  return null;
}

/**
 * Checks if the given string is a recognized system role.
 */
export function isValidRole(role: string | null | undefined): role is SystemRole {
  return normalizeRole(role) !== null;
}

/**
 * Returns the metadata configuration for a given role.
 */
export function getRoleConfig(role: string | null | undefined): RoleMetadata | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  return ROLE_CONFIGS[normalized] || null;
}

/**
 * Returns all configured system roles as a list.
 */
export function getAllRoles(): RoleMetadata[] {
  return Object.values(ROLE_CONFIGS);
}

/**
 * Returns only the staff roles (case_officer, evidence_checker, system_admin).
 */
export function getStaffRoles(): RoleMetadata[] {
  return Object.values(ROLE_CONFIGS).filter((r) => r.isStaff);
}
