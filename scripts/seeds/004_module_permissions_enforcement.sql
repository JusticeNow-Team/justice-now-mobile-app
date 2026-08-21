-- ============================================================================
-- Migration: 004_module_permissions_enforcement.sql
-- Description: Module-Level Row Level Security (RLS) policies enforcing role boundaries (JN-244)
-- ============================================================================

-- 1. Enable RLS on core tables
ALTER TABLE IF EXISTS public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_categories ENABLE ROW LEVEL SECURITY;

-- 2. Case Management Boundary: Only Case Officers and Admins can update case status
DROP POLICY IF EXISTS "Case Officers can update case status" ON public.cases;
CREATE POLICY "Case Officers can update case status"
  ON public.cases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('case_officer', 'system_admin')
    )
  );

-- 3. Evidence Verification Boundary: Only Evidence Checkers and Admins can validate evidence
DROP POLICY IF EXISTS "Evidence Checkers can validate evidence" ON public.evidence;
CREATE POLICY "Evidence Checkers can validate evidence"
  ON public.evidence
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('evidence_checker', 'evidence_validator', 'system_admin')
    )
  );

-- 4. Administration Boundary: Only System Admins can manage categories and staff
DROP POLICY IF EXISTS "System Admins can manage categories" ON public.report_categories;
CREATE POLICY "System Admins can manage categories"
  ON public.report_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );
