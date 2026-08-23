import { SystemRole } from "../auth/types";

export type StaffRole = SystemRole;

export type StaffStatus = "active" | "inactive" | "suspended";

export interface StaffAccount {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  status: StaffStatus;
  department?: string;
  phone?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateStaffInput {
  email: string;
  fullName: string;
  role: StaffRole;
  password?: string;
  department?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateStaffInput {
  fullName?: string;
  role?: StaffRole;
  department?: string;
  phone?: string;
  isActive?: boolean;
  status?: StaffStatus;
}

export type StaffAuditEventType =
  | "STAFF_ACCOUNT_CREATED"
  | "STAFF_ACCOUNT_ACTIVATED"
  | "STAFF_ACCOUNT_DEACTIVATED"
  | "STAFF_ROLE_CHANGED"
  | "STAFF_PASSWORD_RESET";

export interface StaffAuditLog {
  id: string;
  eventType: StaffAuditEventType;
  actorId: string;
  actorEmail: string;
  targetStaffId: string;
  targetStaffEmail: string;
  description: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface StaffValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface StaffFilterOptions {
  role?: StaffRole | "all";
  status?: "all" | "active" | "inactive";
  searchQuery?: string;
}
