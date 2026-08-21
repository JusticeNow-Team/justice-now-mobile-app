-- ============================================================================
-- Migration: 005_audit_events_immutable.sql
-- Description: Immutable Audit Events Log Table & Strict Security Policies (JN-252)
-- ============================================================================

-- 1. Create audit_events table if not exists
CREATE TABLE IF NOT EXISTS public.audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'system_admin',
  target_id UUID,
  target_email TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Read Access: Strictly limited to authorized System Administrators (AC 7)
DROP POLICY IF EXISTS "System Admins can read audit events" ON public.audit_events;
CREATE POLICY "System Admins can read audit events"
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'system_admin'
    )
  );

-- 4. Insert Access: Authenticated users / triggers can insert audit records
DROP POLICY IF EXISTS "Authenticated users can insert audit events" ON public.audit_events;
CREATE POLICY "Authenticated users can insert audit events"
  ON public.audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Immutability Enforcement (AC 5): Forbid UPDATE and DELETE on audit logs
-- PostgreSQL rules to make audit_events strictly append-only
CREATE OR REPLACE RULE audit_events_no_update AS
  ON UPDATE TO public.audit_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_events_no_delete AS
  ON DELETE TO public.audit_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE staff_audit_logs_no_update AS
  ON UPDATE TO public.staff_audit_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE staff_audit_logs_no_delete AS
  ON DELETE TO public.staff_audit_logs DO INSTEAD NOTHING;
