export interface ReportCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  hint?: string;
  icon?: string;
  isActive: boolean;
  isSystemDefault?: boolean;
  displayOrder: number;
  activeCaseCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryInput {
  code?: string;
  name: string;
  description: string;
  hint?: string;
  icon?: string;
  isActive?: boolean;
  isSystemDefault?: boolean;
  displayOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  hint?: string;
  icon?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface CategoryValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface DeleteCategoryResult {
  allowed: boolean;
  reason?: string;
  activeCaseCount?: number;
}

export interface CategoryFilterOptions {
  statusFilter?: "all" | "active" | "inactive";
  searchQuery?: string;
  activeOnly?: boolean;
}

export interface CategoryActor {
  role?: string;
  userId?: string;
  email?: string;
}
