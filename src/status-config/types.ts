export type StatusEntityType = "case" | "evidence";

export type StatusConfigTone =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface WorkflowStatusConfig {
  id: string;
  entityType: StatusEntityType;
  code: string;
  name: string;
  description: string;
  tone: StatusConfigTone;
  icon?: string;
  isActive: boolean;
  isSystemDefault: boolean;
  displayOrder: number;
  activeRecordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStatusConfigInput {
  entityType: StatusEntityType;
  code?: string;
  name: string;
  description: string;
  tone?: StatusConfigTone;
  icon?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdateStatusConfigInput {
  name?: string;
  description?: string;
  tone?: StatusConfigTone;
  icon?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface StatusFilterOptions {
  entityType?: StatusEntityType;
  statusFilter?: "all" | "active" | "inactive";
  searchQuery?: string;
  activeOnly?: boolean;
}

export interface StatusValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface DeleteStatusResult {
  allowed: boolean;
  reason?: string;
  activeRecordCount: number;
}
