-- ============================================================================
-- Migration: 012_admin_case_assignments.sql
-- Description: System Admin case-to-officer assignment support
-- ============================================================================

alter table if exists public.case_assignments enable row level security;

grant select on public.cases to authenticated;
grant update (status, updated_at) on public.cases to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.case_assignments to authenticated;

create or replace function public.is_current_user_system_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role::text = 'system_admin'
      and profiles.is_active = true
  );
$$;

create or replace function public.is_active_case_officer(p_officer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = p_officer_id
      and profiles.role::text = 'case_officer'
      and profiles.is_active = true
  );
$$;

drop policy if exists "System Admins can read case assignments" on public.case_assignments;
create policy "System Admins can read case assignments"
  on public.case_assignments
  for select
  to authenticated
  using (public.is_current_user_system_admin());

drop policy if exists "System Admins can create case assignments" on public.case_assignments;
create policy "System Admins can create case assignments"
  on public.case_assignments
  for insert
  to authenticated
  with check (
    public.is_current_user_system_admin()
    and public.is_active_case_officer(case_assignments.assigned_officer_id)
  );

drop policy if exists "System Admins can deactivate case assignments" on public.case_assignments;
create policy "System Admins can deactivate case assignments"
  on public.case_assignments
  for update
  to authenticated
  using (public.is_current_user_system_admin())
  with check (public.is_current_user_system_admin());

drop policy if exists "Case Officers can read own assignments" on public.case_assignments;
create policy "Case Officers can read own assignments"
  on public.case_assignments
  for select
  to authenticated
  using (
    assigned_officer_id = (select auth.uid())
    and is_active = true
  );

drop policy if exists "System Admins can read cases for assignment" on public.cases;
create policy "System Admins can read cases for assignment"
  on public.cases
  for select
  to authenticated
  using (public.is_current_user_system_admin());

drop policy if exists "Assigned Case Officers can read assigned cases" on public.cases;
create policy "Assigned Case Officers can read assigned cases"
  on public.cases
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.case_assignments as officer_assignment
      where officer_assignment.case_id = cases.id
        and officer_assignment.assigned_officer_id = (select auth.uid())
        and officer_assignment.is_active = true
    )
  );

drop policy if exists "System Admins can read case officers" on public.profiles;
create policy "System Admins can read case officers"
  on public.profiles
  for select
  to authenticated
  using (
    public.is_current_user_system_admin()
    or id = (select auth.uid())
  );

grant execute on function public.is_current_user_system_admin() to authenticated;
grant execute on function public.is_active_case_officer(uuid) to authenticated;

drop function if exists public.assign_case_to_officer(uuid, uuid);

create function public.assign_case_to_officer(
  p_case_id uuid,
  p_officer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_case public.cases%rowtype;
  v_assignment public.case_assignments%rowtype;
  v_previous_status text;
  v_next_status text;
  v_assigned_at timestamptz := now();
begin
  if v_admin_id is null then
    raise exception 'You must be signed in to assign cases.';
  end if;

  if not public.is_current_user_system_admin() then
    raise exception 'Only an active System Admin can assign cases.';
  end if;

  if not public.is_active_case_officer(p_officer_id) then
    raise exception 'Select an active Case Officer before assigning this case.';
  end if;

  select *
  into v_case
  from public.cases
  where id = p_case_id
  for update;

  if v_case.id is null then
    raise exception 'This case could not be found.';
  end if;

  v_previous_status := v_case.status::text;
  v_next_status := case
    when v_previous_status in ('submitted', 'under_review') then 'assigned'
    else v_previous_status
  end;

  update public.case_assignments
  set is_active = false
  where case_assignments.case_id = p_case_id
    and case_assignments.is_active = true;

  insert into public.case_assignments (
    case_id,
    assigned_officer_id,
    assigned_at,
    is_active
  )
  values (
    p_case_id,
    p_officer_id,
    v_assigned_at,
    true
  )
  returning * into v_assignment;

  if v_next_status <> v_previous_status then
    update public.cases
    set
      status = v_next_status::public.case_status,
      updated_at = v_assigned_at
    where id = p_case_id;

    insert into public.case_status_history (
      case_id,
      old_status,
      new_status,
      changed_at
    )
    values (
      p_case_id,
      v_previous_status::public.case_status,
      v_next_status::public.case_status,
      v_assigned_at
    );
  else
    update public.cases
    set updated_at = v_assigned_at
    where id = p_case_id;
  end if;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    actor_id,
    metadata,
    reporter_visible,
    created_at
  )
  values (
    p_case_id,
    'case_assigned',
    'Case assigned',
    'A System Admin assigned this case to a Case Officer.',
    v_admin_id,
    jsonb_build_object(
      'assignment_id', v_assignment.id,
      'assigned_officer_id', p_officer_id,
      'previous_status', v_previous_status,
      'next_status', v_next_status
    ),
    false,
    v_assigned_at
  );

  return;
end;
$$;

drop function if exists public.review_case_assignment(uuid, text);

create function public.review_case_assignment(
  p_case_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_officer_id uuid := auth.uid();
  v_decision text := trim(lower(coalesce(p_decision, '')));
  v_case public.cases%rowtype;
  v_previous_status text;
  v_next_status text;
  v_reviewed_at timestamptz := now();
begin
  if v_officer_id is null then
    raise exception 'You must be signed in to review a case assignment.';
  end if;

  if not exists (
    select 1
    from public.profiles as officer
    where officer.id = v_officer_id
      and officer.role::text = 'case_officer'
      and officer.is_active = true
  ) then
    raise exception 'Only an active Case Officer can review case assignments.';
  end if;

  if v_decision not in ('accepted', 'rejected') then
    raise exception 'Choose accepted or rejected for this assignment.';
  end if;

  if not exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = p_case_id
      and officer_assignment.assigned_officer_id = v_officer_id
      and officer_assignment.is_active = true
  ) then
    raise exception 'This case is not actively assigned to your officer account.';
  end if;

  select *
  into v_case
  from public.cases
  where id = p_case_id
  for update;

  if v_case.id is null then
    raise exception 'This case could not be found.';
  end if;

  v_previous_status := v_case.status::text;

  if v_decision = 'accepted' then
    v_next_status := 'under_review';
  else
    update public.case_assignments
    set is_active = false
    where case_assignments.case_id = p_case_id
      and case_assignments.assigned_officer_id = v_officer_id
      and case_assignments.is_active = true;

    v_next_status := case
      when v_previous_status in ('assigned', 'under_review') then 'submitted'
      else v_previous_status
    end;
  end if;

  if v_next_status <> v_previous_status then
    update public.cases
    set
      status = v_next_status::public.case_status,
      updated_at = v_reviewed_at
    where id = p_case_id;

    insert into public.case_status_history (
      case_id,
      old_status,
      new_status,
      changed_at
    )
    values (
      p_case_id,
      v_previous_status::public.case_status,
      v_next_status::public.case_status,
      v_reviewed_at
    );
  else
    update public.cases
    set updated_at = v_reviewed_at
    where id = p_case_id;
  end if;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    actor_id,
    metadata,
    reporter_visible,
    created_at
  )
  values (
    p_case_id,
    'case_assignment_reviewed',
    'Case assignment reviewed',
    case
      when v_decision = 'accepted'
        then 'The assigned Case Officer accepted this case.'
      else 'The assigned Case Officer rejected this case assignment.'
    end,
    v_officer_id,
    jsonb_build_object(
      'decision', v_decision,
      'previous_status', v_previous_status,
      'next_status', v_next_status
    ),
    false,
    v_reviewed_at
  );

  return;
end;
$$;

revoke all on function public.assign_case_to_officer(uuid, uuid) from public, anon;
revoke all on function public.review_case_assignment(uuid, text) from public, anon;

grant execute on function public.assign_case_to_officer(uuid, uuid) to authenticated;
grant execute on function public.review_case_assignment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
