import { SystemRole } from "../auth/types";

export type StaffRole = SystemRole;

export type StaffStatus = "active" | "inactive" | "suspended";

export type CheckerAvailabilityStatus = "available" | "busy" | "away" | "inactive";

export interface StaffAccount {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  status: StaffStatus;
  availabilityStatus?: CheckerAvailabilityStatus;
  activeAssignmentsCount?: number;
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
  availabilityStatus?: CheckerAvailabilityStatus;
}

export interface UpdateStaffInput {
  fullName?: string;
  role?: StaffRole;
  department?: string;
  phone?: string;
  isActive?: boolean;
  status?: StaffStatus;
  availabilityStatus?: CheckerAvailabilityStatus;
}

export interface CheckerAvailabilityRecord {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  availabilityStatus: CheckerAvailabilityStatus;
  activeAssignmentsCount: number;
  department?: string;
  phone?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckerAvailabilityUpdateInput {
  checkerId: string;
  isActive: boolean;
  availabilityStatus: CheckerAvailabilityStatus;
  reason?: string;
}

export type StaffAuditEventType =
  | "STAFF_ACCOUNT_CREATED"
  | "STAFF_ACCOUNT_ACTIVATED"
  | "STAFF_ACCOUNT_DEACTIVATED"
  | "STAFF_ROLE_CHANGED"
  | "STAFF_PASSWORD_RESET"
  | "CHECKER_AVAILABILITY_CHANGED"
  | "CHECKER_ACTIVATED"
  | "CHECKER_DEACTIVATED";

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
  availability?: "all" | CheckerAvailabilityStatus;
  searchQuery?: string;
}

