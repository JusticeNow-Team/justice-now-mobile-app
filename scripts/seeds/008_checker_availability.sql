-- =========================================================
-- JN-266: Manage Evidence Checker availability
-- =========================================================
-- Adds availability status tracking and administrative governance
-- ensuring evidence assignments target active authorized personnel only.

-- 1. Extend profiles table with availability_status
alter table public.profiles
add column if not exists availability_status text not null default 'available'
  check (availability_status in ('available', 'busy', 'away', 'inactive'));

-- 2. Create index for fast availability queries
create index if not exists idx_profiles_checker_availability
on public.profiles (role, is_active, availability_status)
where role in ('evidence_checker', 'evidence_validator');

-- 3. Update get_available_evidence_checkers to filter by active and available status
create or replace function public.get_available_evidence_checkers(p_case_id uuid)
returns table (
  id uuid,
  full_name text,
  active_assignment_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officer_id uuid := auth.uid();
begin
  if v_officer_id is null then
    raise exception 'You must be signed in to assign evidence.';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Multi-factor authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as officer
    where officer.id = v_officer_id
      and officer.role::text = 'case_officer'
      and officer.is_active = true
  ) then
    raise exception 'Only an active Case Officer can assign evidence.';
  end if;

  if not exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = p_case_id
      and officer_assignment.assigned_officer_id = v_officer_id
      and officer_assignment.is_active = true
  ) then
    raise exception 'You are not the active Case Officer for this case.';
  end if;

  return query
  select
    checker.id,
    checker.full_name,
    count(assignment.id) filter (
      where assignment.status in ('assigned', 'under_review')
    )::bigint as active_assignment_count
  from public.profiles as checker
  left join public.evidence_assignments as assignment
    on assignment.evidence_checker_id = checker.id
  where checker.role::text in ('evidence_checker', 'evidence_validator')
    and checker.is_active = true
    and coalesce(checker.availability_status, 'available') in ('available', 'busy')
  group by checker.id, checker.full_name
  order by 3 asc, checker.full_name asc;
end;
$$;

-- 4. Secure admin function to toggle checker availability and log audit event
create or replace function public.admin_set_checker_availability(
  p_checker_id uuid,
  p_is_active boolean,
  p_availability_status text default 'available',
  p_reason text default 'Administrative status update'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_prev_active boolean;
  v_prev_status text;
  v_checker_name text;
  v_active_assignments bigint;
begin
  -- Check admin authorization
  select email into v_admin_email
  from public.profiles
  where id = v_admin_id
    and role::text = 'system_admin'
    and is_active = true;

  if v_admin_email is null then
    raise exception 'Unauthorized: Only active System Administrators can update checker availability.';
  end if;

  -- Verify checker exists
  select full_name, is_active, availability_status
  into v_checker_name, v_prev_active, v_prev_status
  from public.profiles
  where id = p_checker_id
    and role::text in ('evidence_checker', 'evidence_validator');

  if v_checker_name is null then
    raise exception 'Evidence Checker account not found.';
  end if;

  -- Count ongoing reviews
  select count(*)
  into v_active_assignments
  from public.evidence_assignments
  where evidence_checker_id = p_checker_id
    and status in ('assigned', 'under_review');

  -- Update profile
  update public.profiles
  set
    is_active = p_is_active,
    availability_status = case when p_is_active = false then 'inactive' else p_availability_status end,
    updated_at = now()
  where id = p_checker_id;

  -- Record audit event
  insert into public.audit_events (
    event_type,
    actor_id,
    actor_email,
    actor_role,
    target_id,
    target_email,
    action,
    description,
    details
  )
  values (
    'CHECKER_AVAILABILITY_CHANGED',
    v_admin_id,
    v_admin_email,
    'system_admin',
    p_checker_id,
    (select email from public.profiles where id = p_checker_id),
    case when p_is_active = false then 'DEACTIVATE_CHECKER' else 'UPDATE_AVAILABILITY' end,
    format('Updated Evidence Checker %s status (Active: %s, Availability: %s). Reason: %s', v_checker_name, p_is_active, p_availability_status, p_reason),
    jsonb_build_object(
      'checker_id', p_checker_id,
      'checker_name', v_checker_name,
      'previous_is_active', v_prev_active,
      'previous_availability', v_prev_status,
      'new_is_active', p_is_active,
      'new_availability', case when p_is_active = false then 'inactive' else p_availability_status end,
      'active_assignments_count', v_active_assignments,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'success', true,
    'checker_id', p_checker_id,
    'is_active', p_is_active,
    'availability_status', case when p_is_active = false then 'inactive' else p_availability_status end,
    'active_assignments_count', v_active_assignments
  );
end;
$$;
