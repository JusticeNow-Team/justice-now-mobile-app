export interface ReportCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  hint?: string;
  icon?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryInput {
  code: string;
  name: string;
  description: string;
  hint?: string;
  icon?: string;
  isActive?: boolean;
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
