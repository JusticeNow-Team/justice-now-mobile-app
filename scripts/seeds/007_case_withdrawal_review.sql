-- =========================================================
-- JN-361: Case Officer withdrawal request review
-- =========================================================
-- Run after the core JusticeNow case, profile, assignment, and timeline tables.

create table if not exists public.case_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested', 'pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by_officer_id uuid references public.profiles(id),
  decision_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_withdrawal_requests
add column if not exists reviewed_by_officer_id uuid references public.profiles(id);

alter table public.case_withdrawal_requests
add column if not exists decision_reason text;

alter table public.case_withdrawal_requests
add column if not exists reviewed_at timestamptz;

alter table public.case_withdrawal_requests
add column if not exists created_at timestamptz not null default now();

alter table public.case_withdrawal_requests
add column if not exists updated_at timestamptz not null default now();

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_record.conname
    from pg_constraint as constraint_record
    join pg_class as table_record
      on table_record.oid = constraint_record.conrelid
    join pg_namespace as schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'case_withdrawal_requests'
      and constraint_record.contype = 'c'
      and pg_get_constraintdef(constraint_record.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.case_withdrawal_requests drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

alter table public.case_withdrawal_requests
drop constraint if exists case_withdrawal_requests_status_check;

alter table public.case_withdrawal_requests
add constraint case_withdrawal_requests_status_check
check (status in ('requested', 'pending', 'approved', 'rejected'))
not valid;

create unique index if not exists case_withdrawal_requests_one_pending_per_case
on public.case_withdrawal_requests (case_id)
where status in ('requested', 'pending');

create index if not exists case_withdrawal_requests_case_requested_idx
on public.case_withdrawal_requests (case_id, requested_at desc);

create index if not exists case_withdrawal_requests_reporter_idx
on public.case_withdrawal_requests (reporter_id, requested_at desc);

alter table public.case_withdrawal_requests enable row level security;

grant select, insert on public.case_withdrawal_requests to authenticated;

drop policy if exists "Reporters can view their own withdrawal requests"
on public.case_withdrawal_requests;

create policy "Reporters can view their own withdrawal requests"
on public.case_withdrawal_requests
for select
to authenticated
using (reporter_id = (select auth.uid()));

drop policy if exists "Reporters can create their own withdrawal requests"
on public.case_withdrawal_requests;

create policy "Reporters can create their own withdrawal requests"
on public.case_withdrawal_requests
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles as reporter
    where reporter.id = (select auth.uid())
      and reporter.role::text = 'reporter'
      and reporter.is_active = true
  )
  and exists (
    select 1
    from public.cases as reporter_case
    where reporter_case.id = case_withdrawal_requests.case_id
      and reporter_case.reporter_id = (select auth.uid())
  )
);

drop policy if exists "Assigned officers can view withdrawal requests"
on public.case_withdrawal_requests;

create policy "Assigned officers can view withdrawal requests"
on public.case_withdrawal_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = case_withdrawal_requests.case_id
      and officer_assignment.assigned_officer_id = (select auth.uid())
      and officer_assignment.is_active = true
  )
  or exists (
    select 1
    from public.profiles as admin_profile
    where admin_profile.id = (select auth.uid())
      and admin_profile.role::text = 'system_admin'
      and admin_profile.is_active = true
  )
);

drop function if exists public.get_officer_case_withdrawal_requests(uuid);

create function public.get_officer_case_withdrawal_requests(
  p_case_id uuid default null
)
returns table (
  withdrawal_id uuid,
  case_id uuid,
  case_reference text,
  case_title text,
  reporter_id uuid,
  request_reason text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  decision_reason text,
  reviewer_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officer_id uuid := auth.uid();
begin
  if v_officer_id is null then
    raise exception 'You must be signed in to view withdrawal requests.';
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
    raise exception 'Only an active Case Officer can view withdrawal requests.';
  end if;

  if p_case_id is not null and not exists (
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
    withdrawal_request.id,
    case_record.id,
    case_record.case_reference,
    case_record.title,
    withdrawal_request.reporter_id,
    withdrawal_request.reason,
    withdrawal_request.status,
    withdrawal_request.requested_at,
    withdrawal_request.reviewed_at,
    withdrawal_request.decision_reason,
    reviewer.full_name
  from public.case_withdrawal_requests as withdrawal_request
  join public.cases as case_record
    on case_record.id = withdrawal_request.case_id
  join public.case_assignments as officer_assignment
    on officer_assignment.case_id = withdrawal_request.case_id
   and officer_assignment.assigned_officer_id = v_officer_id
   and officer_assignment.is_active = true
  left join public.profiles as reviewer
    on reviewer.id = withdrawal_request.reviewed_by_officer_id
  where p_case_id is null or withdrawal_request.case_id = p_case_id
  order by withdrawal_request.requested_at desc;
end;
$$;

drop function if exists public.review_case_withdrawal_request(uuid, text, text);

create function public.review_case_withdrawal_request(
  p_request_id uuid,
  p_decision text,
  p_reason text
)
returns table (
  withdrawal_id uuid,
  case_id uuid,
  decision text,
  previous_status text,
  next_status text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officer_id uuid := auth.uid();
  v_decision text := trim(lower(coalesce(p_decision, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_request public.case_withdrawal_requests%rowtype;
  v_case public.cases%rowtype;
  v_previous_status text;
  v_next_status text;
  v_reviewed_at timestamptz := now();
  v_public_title text;
  v_public_description text;
begin
  if v_officer_id is null then
    raise exception 'You must be signed in to review a withdrawal request.';
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
    raise exception 'Only an active Case Officer can review withdrawal requests.';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'Select approve or reject for this withdrawal request.';
  end if;

  if length(v_reason) < 10 then
    raise exception 'Add a decision reason before submitting.';
  end if;

  select withdrawal_request.*
  into v_request
  from public.case_withdrawal_requests as withdrawal_request
  where withdrawal_request.id = p_request_id
    and withdrawal_request.status in ('requested', 'pending')
  for update;

  if v_request.id is null then
    raise exception 'This pending withdrawal request could not be found.';
  end if;

  if not exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = v_request.case_id
      and officer_assignment.assigned_officer_id = v_officer_id
      and officer_assignment.is_active = true
  ) then
    raise exception 'You are not the active Case Officer for this case.';
  end if;

  select case_record.*
  into v_case
  from public.cases as case_record
  where case_record.id = v_request.case_id
  for update;

  if v_case.id is null then
    raise exception 'This case could not be found.';
  end if;

  v_previous_status := v_case.status::text;

  if v_decision = 'approved' then
    v_next_status := 'closed';
    v_public_title := 'Withdrawal approved';
    v_public_description := format(
      'Your withdrawal request was approved. Reason: %s',
      v_reason
    );
  else
    select status_history.old_status::text
    into v_next_status
    from public.case_status_history as status_history
    where status_history.case_id = v_case.id
      and status_history.new_status::text = 'withdrawal_requested'
    order by status_history.changed_at desc
    limit 1;

    if v_next_status is null
       or v_next_status in ('resolved', 'closed', 'withdrawal_requested') then
      v_next_status := 'investigating';
    end if;

    v_public_title := 'Withdrawal rejected';
    v_public_description := format(
      'Your withdrawal request was rejected. The case remains active. Reason: %s',
      v_reason
    );
  end if;

  update public.case_withdrawal_requests
  set
    status = v_decision,
    reviewed_by_officer_id = v_officer_id,
    decision_reason = v_reason,
    reviewed_at = v_reviewed_at,
    updated_at = v_reviewed_at
  where id = v_request.id;

  update public.cases
  set
    status = v_next_status::public.case_status,
    updated_at = v_reviewed_at
  where id = v_case.id;

  if v_previous_status <> v_next_status then
    insert into public.case_status_history (
      case_id,
      old_status,
      new_status,
      changed_at
    )
    values (
      v_case.id,
      v_previous_status::public.case_status,
      v_next_status::public.case_status,
      v_reviewed_at
    );
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
    v_case.id,
    'withdrawal_request_reviewed',
    'Withdrawal request reviewed',
    format('Withdrawal request %s by Case Officer.', v_decision),
    v_officer_id,
    jsonb_build_object(
      'withdrawal_request_id', v_request.id,
      'decision', v_decision,
      'decision_reason', v_reason,
      'previous_status', v_previous_status,
      'next_status', v_next_status
    ),
    false,
    v_reviewed_at
  );

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
    v_case.id,
    'withdrawal_decision_available',
    v_public_title,
    v_public_description,
    v_officer_id,
    jsonb_build_object(
      'withdrawal_request_id', v_request.id,
      'decision', v_decision,
      'next_status', v_next_status
    ),
    true,
    v_reviewed_at
  );

  return query
  select
    v_request.id,
    v_case.id,
    v_decision,
    v_previous_status,
    v_next_status,
    v_reviewed_at;
end;
$$;

revoke all on function public.get_officer_case_withdrawal_requests(uuid)
from public, anon;
revoke all on function public.review_case_withdrawal_request(uuid, text, text)
from public, anon;

grant execute on function public.get_officer_case_withdrawal_requests(uuid)
to authenticated;
grant execute on function public.review_case_withdrawal_request(uuid, text, text)
to authenticated;

notify pgrst, 'reload schema';
