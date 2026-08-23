-- ============================================================================
-- Migration: 003_staff_management_and_audit.sql
-- Description: Schema and policies for Staff Account Management and Audit Events (JN-191)
-- ============================================================================

-- 1. Ensure profiles table has status, is_active, and department columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Create staff_audit_logs table
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('STAFF_ACCOUNT_CREATED', 'STAFF_ACCOUNT_ACTIVATED', 'STAFF_ACCOUNT_DEACTIVATED', 'STAFF_ROLE_CHANGED', 'STAFF_PASSWORD_RESET')),
  actor_id TEXT,
  actor_email TEXT NOT NULL,
  target_staff_id TEXT NOT NULL,
  target_staff_email TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_target ON public.staff_audit_logs (target_staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_event_type ON public.staff_audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_created_at ON public.staff_audit_logs (created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Only System Administrators can view and write staff audit logs
CREATE POLICY "System Admins can view staff audit logs"
  ON public.staff_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

CREATE POLICY "System Admins can insert staff audit logs"
  ON public.staff_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );
