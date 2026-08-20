export type SystemRole =
  | "reporter"
  | "case_officer"
  | "evidence_checker"
  | "system_admin";

export type RoleAlias = "evidence_validator";

export type AllRoles = SystemRole | RoleAlias;

export type Permission =
  // Case domain
  | "cases:create"
  | "cases:read:own"
  | "cases:read:assigned"
  | "cases:read:all"
  | "cases:update:status"
  | "cases:request_info"
  | "cases:delete"
  // Evidence domain
  | "evidence:upload:own"
  | "evidence:read:own"
  | "evidence:read:assigned"
  | "evidence:read:all"
  | "evidence:validate"
  | "evidence:assign"
  // Profile domain
  | "profile:read:own"
  | "profile:update:own"
  | "profile:security:manage"
  // Administration domain
  | "admin:users:read"
  | "admin:users:manage"
  | "admin:roles:manage"
  | "admin:audit_logs:read"
  | "admin:system:configure";

export interface RoleMetadata {
  id: SystemRole;
  name: string;
  label: string;
  description: string;
  icon: string;
  badgeColor: {
    background: string;
    text: string;
    border: string;
  };
  defaultRoute: string;
  isStaff: boolean;
  permissions: Permission[];
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  role: SystemRole;
  created_at?: string;
  updated_at?: string;
}

export interface AuthContextValue {
  user: UserProfile | null;
  role: SystemRole | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  hasRole: (role: SystemRole | SystemRole[]) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface RouteAuthorizationRule {
  pathPrefix: string;
  allowedRoles: SystemRole[];
  requiredPermissions?: Permission[];
}
