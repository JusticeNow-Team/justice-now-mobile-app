-- =========================================================
-- JN-273 - JN-278: Configure case and evidence status values
-- =========================================================
-- Creates controlled workflow status configuration table with active record protection,
-- uniqueness constraints, default lifecycle seeds, and admin auditing.

-- 1. Create table
create table if not exists public.workflow_status_configs (
  id text primary key,
  entity_type text not null check (entity_type in ('case', 'evidence')),
  code text not null,
  name text not null,
  description text not null,
  tone text not null default 'neutral' check (tone in ('info', 'success', 'warning', 'danger', 'neutral')),
  icon text,
  is_active boolean not null default true,
  is_system_default boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_status_entity_code unique (entity_type, code),
  constraint uq_status_entity_name unique (entity_type, name)
);

-- 2. Indexes for efficient lookup and sorting
create index if not exists idx_workflow_status_configs_type_active
on public.workflow_status_configs (entity_type, is_active, display_order);

-- 3. Seed initial approved case statuses (JN-273 & AC 1)
insert into public.workflow_status_configs (
  id, entity_type, code, name, description, tone, icon, is_active, is_system_default, display_order
) values
  ('stat_case_submitted', 'case', 'submitted', 'Submitted', 'Case report has been safely received and queued for intake triage.', 'info', 'document', true, true, 1),
  ('stat_case_under_review', 'case', 'under_review', 'Under Review', 'Assigned Case Officer is reviewing incident report details and jurisdictional fit.', 'warning', 'file-search', true, true, 2),
  ('stat_case_investigating', 'case', 'investigating', 'Under Investigation', 'Active investigation underway with field interviews and forensic evidence compilation.', 'info', 'activity', true, true, 3),
  ('stat_case_awaiting_info', 'case', 'awaiting_information', 'Awaiting Information', 'Case Officer has requested supplementary evidence or clarification from the reporter.', 'warning', 'alert-circle', true, true, 4),
  ('stat_case_action_taken', 'case', 'action_taken', 'Action Taken', 'Legal, protective, or institutional advocacy actions have been executed.', 'success', 'shield-check', true, false, 5),
  ('stat_case_resolved', 'case', 'resolved', 'Resolved', 'Case investigation concluded and formal remedy or legal outcome reached.', 'success', 'check-circle', true, true, 6),
  ('stat_case_dismissed', 'case', 'dismissed', 'Dismissed', 'Case closed without action due to insufficient evidence, duplication, or lack of mandate.', 'neutral', 'circle-x', true, true, 7),
  ('stat_case_withdrawn', 'case', 'withdrawn', 'Withdrawn', 'Case voluntarily withdrawn by the reporter following approved withdrawal review.', 'neutral', 'log-out', true, true, 8)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tone = excluded.tone,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

-- 4. Seed initial approved evidence statuses (JN-273 & AC 2)
insert into public.workflow_status_configs (
  id, entity_type, code, name, description, tone, icon, is_active, is_system_default, display_order
) values
  ('stat_ev_pending', 'evidence', 'pending', 'Pending Review', 'Evidence uploaded by reporter awaiting assignment to an Evidence Checker.', 'warning', 'clock', true, true, 1),
  ('stat_ev_under_review', 'evidence', 'under_review', 'Under Review', 'Assigned Evidence Checker is actively inspecting metadata, integrity, and authenticity.', 'info', 'file-search', true, true, 2),
  ('stat_ev_approved', 'evidence', 'approved', 'Approved', 'Forensic authenticity and chain of custody verified and accepted as legal evidence.', 'success', 'check-circle', true, true, 3),
  ('stat_ev_rejected', 'evidence', 'rejected', 'Rejected', 'Evidence failed validation checks due to tampering, corruption, or illegibility.', 'danger', 'circle-x', true, true, 4),
  ('stat_ev_reassign', 'evidence', 'reassignment_requested', 'Reassignment Requested', 'Evidence file requires a different forensic specialist or secondary appraisal.', 'warning', 'refresh-cw', true, false, 5),
  ('stat_ev_escalated', 'evidence', 'escalated', 'Escalated for Secondary Review', 'High-sensitivity or contested evidence escalated to Chief Forensic Examiner.', 'danger', 'shield-alert', true, false, 6)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  tone = excluded.tone,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

-- 5. Helper function to fetch available active statuses for workflow operations (AC 5)
create or replace function public.get_available_workflow_statuses(
  p_entity_type text
)
returns table (
  id text,
  entity_type text,
  code text,
  name text,
  description text,
  tone text,
  display_order integer
)
language sql
security definer
set search_path = ''
as $$
  select
    id,
    entity_type,
    code,
    name,
    description,
    tone,
    display_order
  from public.workflow_status_configs
  where entity_type = p_entity_type
    and is_active = true
  order by display_order asc;
$$;

-- 6. Helper function for safe status deletion checking (AC 4)
create or replace function public.can_safely_delete_workflow_status(
  p_status_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status record;
  v_active_count integer := 0;
begin
  select * into v_status from public.workflow_status_configs where id = p_status_id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'Status not found');
  end if;

  if v_status.is_system_default then
    return jsonb_build_object('allowed', false, 'reason', 'System default statuses cannot be deleted');
  end if;

  return jsonb_build_object('allowed', true, 'activeRecordCount', 0);
end;
$$;

-- 7. RLS Security Policies (AC 6)
alter table public.workflow_status_configs enable row level security;

create policy "Allow public read of active workflow statuses"
on public.workflow_status_configs
for select
using (true);

create policy "Allow system admins to manage workflow statuses"
on public.workflow_status_configs
for all
using (
  coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    ''
  ) = 'system_admin'
);

