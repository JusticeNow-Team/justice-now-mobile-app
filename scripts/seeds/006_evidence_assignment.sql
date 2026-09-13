-- =========================================================
-- JN-340: Assign evidence to an Evidence Validator
-- =========================================================
-- Run after the core JusticeNow case, profile, assignment, and evidence tables.

create table if not exists public.evidence_assignments (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.case_evidence(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  assigned_checker_id uuid not null references public.profiles(id),
  assigned_by_officer_id uuid not null references public.profiles(id),
  status text not null default 'assigned'
    check (status in ('assigned', 'under_review', 'completed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists evidence_assignments_one_active_per_evidence
on public.evidence_assignments (evidence_id)
where status in ('assigned', 'under_review');

create index if not exists evidence_assignments_checker_queue_idx
on public.evidence_assignments (assigned_checker_id, status, assigned_at desc);

create index if not exists evidence_assignments_case_history_idx
on public.evidence_assignments (case_id, assigned_at desc);

create table if not exists public.case_timeline_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  actor_id uuid references public.profiles(id),
  reporter_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists case_timeline_events_case_created_idx
on public.case_timeline_events (case_id, created_at desc);

alter table public.evidence_assignments enable row level security;
alter table public.case_timeline_events enable row level security;

grant select on public.evidence_assignments to authenticated;
grant select on public.case_timeline_events to authenticated;

drop policy if exists "Assigned staff can view evidence assignments"
on public.evidence_assignments;

create policy "Assigned staff can view evidence assignments"
on public.evidence_assignments
for select
to authenticated
using (
  assigned_checker_id = (select auth.uid())
  or exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = evidence_assignments.case_id
      and officer_assignment.assigned_officer_id = (select auth.uid())
      and officer_assignment.is_active = true
  )
  or exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and viewer.is_active = true
  )
);

drop policy if exists "Authorized users can view case timeline events"
on public.case_timeline_events;

create policy "Authorized users can view case timeline events"
on public.case_timeline_events
for select
to authenticated
using (
  exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = case_timeline_events.case_id
      and officer_assignment.assigned_officer_id = (select auth.uid())
      and officer_assignment.is_active = true
  )
  or exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and viewer.is_active = true
  )
  or (
    reporter_visible = true
    and exists (
      select 1
      from public.cases as reporter_case
      where reporter_case.id = case_timeline_events.case_id
        and reporter_case.reporter_id = (select auth.uid())
    )
  )
);

-- The Validator can read only evidence explicitly assigned to them.
drop policy if exists "Validators can view assigned case evidence"
on public.case_evidence;

create policy "Validators can view assigned case evidence"
on public.case_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.evidence_assignments as validator_assignment
    where validator_assignment.evidence_id = case_evidence.id
      and validator_assignment.assigned_checker_id = (select auth.uid())
      and validator_assignment.status in ('assigned', 'under_review')
  )
);

-- The matching private Storage object is available only while the assignment
-- is active. Existing Reporter/Officer policies remain in place.
drop policy if exists "Validators can view assigned evidence files"
on storage.objects;

create policy "Validators can view assigned evidence files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'case-evidence'
  and exists (
    select 1
    from public.case_evidence as assigned_evidence
    join public.evidence_assignments as validator_assignment
      on validator_assignment.evidence_id = assigned_evidence.id
    where assigned_evidence.storage_bucket = objects.bucket_id
      and assigned_evidence.storage_path = objects.name
      and validator_assignment.assigned_checker_id = (select auth.uid())
      and validator_assignment.status in ('assigned', 'under_review')
  )
);

drop function if exists public.get_available_evidence_checkers(uuid);

create function public.get_available_evidence_checkers(p_case_id uuid)
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
    on assignment.assigned_checker_id = checker.id
  where checker.role::text = 'evidence_validator'
    and checker.is_active = true
  group by checker.id, checker.full_name
  order by 3 asc, checker.full_name asc;
end;
$$;

drop function if exists public.get_officer_evidence_assignments(uuid);

create function public.get_officer_evidence_assignments(p_case_id uuid default null)
returns table (
  assignment_id uuid,
  evidence_id uuid,
  checker_id uuid,
  checker_name text,
  status text,
  assigned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officer_id uuid := auth.uid();
begin
  if v_officer_id is null then
    raise exception 'You must be signed in to view evidence assignments.';
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
    raise exception 'Only an active Case Officer can view these assignments.';
  end if;

  return query
  select
    assignment.id,
    assignment.evidence_id,
    assignment.assigned_checker_id,
    checker.full_name,
    assignment.status,
    assignment.assigned_at
  from public.evidence_assignments as assignment
  join public.profiles as checker
    on checker.id = assignment.assigned_checker_id
  join public.case_assignments as officer_assignment
    on officer_assignment.case_id = assignment.case_id
   and officer_assignment.assigned_officer_id = v_officer_id
   and officer_assignment.is_active = true
  where p_case_id is null or assignment.case_id = p_case_id
  order by assignment.assigned_at desc;
end;
$$;

drop function if exists public.assign_evidence_to_checker(uuid, uuid);

create function public.assign_evidence_to_checker(
  p_evidence_id uuid,
  p_checker_id uuid
)
returns table (
  assignment_id uuid,
  evidence_id uuid,
  checker_id uuid,
  checker_name text,
  status text,
  assigned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officer_id uuid := auth.uid();
  v_case_id uuid;
  v_evidence_title text;
  v_assignment public.evidence_assignments%rowtype;
  v_checker_name text;
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

  select evidence.case_id, evidence.title
  into v_case_id, v_evidence_title
  from public.case_evidence as evidence
  where evidence.id = p_evidence_id
    and evidence.validation_status::text = 'pending'
  for update;

  if v_case_id is null then
    raise exception 'Only pending evidence can be assigned.';
  end if;

  if not exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = v_case_id
      and officer_assignment.assigned_officer_id = v_officer_id
      and officer_assignment.is_active = true
  ) then
    raise exception 'You are not the active Case Officer for this evidence.';
  end if;

  select checker.full_name
  into v_checker_name
  from public.profiles as checker
  where checker.id = p_checker_id
    and checker.role::text = 'evidence_validator'
    and checker.is_active = true;

  if v_checker_name is null then
    raise exception 'Select an active Evidence Validator.';
  end if;

  if exists (
    select 1
    from public.evidence_assignments as active_assignment
    where active_assignment.evidence_id = p_evidence_id
      and active_assignment.status in ('assigned', 'under_review')
  ) then
    raise exception 'This evidence already has an active assignment.';
  end if;

  begin
    insert into public.evidence_assignments (
      evidence_id,
      case_id,
      assigned_checker_id,
      assigned_by_officer_id
    )
    values (
      p_evidence_id,
      v_case_id,
      p_checker_id,
      v_officer_id
    )
    returning * into v_assignment;
  exception
    when unique_violation then
      raise exception 'This evidence already has an active assignment.';
  end;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    actor_id,
    reporter_visible
  )
  values (
    v_case_id,
    'evidence_assigned',
    'Evidence assigned for validation',
    format('%s was assigned to %s.', v_evidence_title, v_checker_name),
    v_officer_id,
    false
  );

  return query
  select
    v_assignment.id,
    v_assignment.evidence_id,
    v_assignment.assigned_checker_id,
    v_checker_name,
    v_assignment.status,
    v_assignment.assigned_at;
end;
$$;

drop function if exists public.get_my_evidence_assignments();

create function public.get_my_evidence_assignments()
returns table (
  assignment_id uuid,
  assignment_status text,
  assigned_at timestamptz,
  started_at timestamptz,
  evidence_id uuid,
  evidence_type text,
  evidence_title text,
  evidence_description text,
  evidence_created_at timestamptz,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  validation_status text,
  case_id uuid,
  case_reference text,
  case_title text,
  case_category text,
  case_incident_date date,
  case_priority text,
  is_anonymous boolean,
  assigned_by_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checker_id uuid := auth.uid();
begin
  if v_checker_id is null then
    raise exception 'You must be signed in to view assigned evidence.';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Multi-factor authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as checker
    where checker.id = v_checker_id
      and checker.role::text = 'evidence_validator'
      and checker.is_active = true
  ) then
    raise exception 'Only an active Evidence Validator can view this queue.';
  end if;

  return query
  select
    assignment.id,
    assignment.status,
    assignment.assigned_at,
    assignment.started_at,
    evidence.id,
    evidence.evidence_type::text,
    evidence.title,
    evidence.description,
    evidence.created_at,
    evidence.file_name,
    evidence.storage_bucket,
    evidence.storage_path,
    evidence.mime_type,
    evidence.file_size_bytes::bigint,
    evidence.validation_status::text,
    case_record.id,
    case_record.case_reference,
    case_record.title,
    case_record.category::text,
    case_record.incident_date,
    case_record.priority::text,
    case_record.is_anonymous,
    officer.full_name
  from public.evidence_assignments as assignment
  join public.case_evidence as evidence
    on evidence.id = assignment.evidence_id
  join public.cases as case_record
    on case_record.id = assignment.case_id
  join public.profiles as officer
    on officer.id = assignment.assigned_by_officer_id
  where assignment.assigned_checker_id = v_checker_id
    and assignment.status in ('assigned', 'under_review')
  order by assignment.assigned_at desc;
end;
$$;

drop function if exists public.get_my_evidence_assignment_detail(uuid);

create function public.get_my_evidence_assignment_detail(p_assignment_id uuid)
returns table (
  assignment_id uuid,
  assignment_status text,
  assigned_at timestamptz,
  started_at timestamptz,
  evidence_id uuid,
  evidence_type text,
  evidence_title text,
  evidence_description text,
  evidence_created_at timestamptz,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  validation_status text,
  case_id uuid,
  case_reference text,
  case_title text,
  case_category text,
  case_incident_date date,
  case_priority text,
  is_anonymous boolean,
  assigned_by_name text
)
language sql
security definer
set search_path = ''
as $$
  select queue_item.*
  from public.get_my_evidence_assignments() as queue_item
  where queue_item.assignment_id = p_assignment_id;
$$;

drop function if exists public.start_my_evidence_review(uuid);

create function public.start_my_evidence_review(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checker_id uuid := auth.uid();
  v_case_id uuid;
  v_evidence_id uuid;
begin
  if v_checker_id is null then
    raise exception 'You must be signed in to start an evidence review.';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Multi-factor authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as checker
    where checker.id = v_checker_id
      and checker.role::text = 'evidence_validator'
      and checker.is_active = true
  ) then
    raise exception 'Only an active Evidence Validator can start this review.';
  end if;

  update public.evidence_assignments as assignment
  set
    status = 'under_review',
    started_at = coalesce(assignment.started_at, now()),
    updated_at = now()
  where assignment.id = p_assignment_id
    and assignment.assigned_checker_id = v_checker_id
    and assignment.status in ('assigned', 'under_review')
  returning assignment.case_id, assignment.evidence_id
  into v_case_id, v_evidence_id;

  if v_evidence_id is null then
    raise exception 'This active evidence assignment could not be found.';
  end if;

  update public.case_evidence
  set validation_status = 'under_review'
  where id = v_evidence_id
    and validation_status::text = 'pending';

  if not exists (
    select 1
    from public.case_timeline_events as timeline_event
    where timeline_event.case_id = v_case_id
      and timeline_event.event_type = 'evidence_review_started'
      and timeline_event.actor_id = v_checker_id
      and timeline_event.description = v_evidence_id::text
  ) then
    insert into public.case_timeline_events (
      case_id,
      event_type,
      title,
      description,
      actor_id,
      reporter_visible
    )
    values (
      v_case_id,
      'evidence_review_started',
      'Evidence validation started',
      v_evidence_id::text,
      v_checker_id,
      false
    );
  end if;
end;
$$;

revoke all on function public.get_available_evidence_checkers(uuid)
from public, anon;
revoke all on function public.get_officer_evidence_assignments(uuid)
from public, anon;
revoke all on function public.assign_evidence_to_checker(uuid, uuid)
from public, anon;
revoke all on function public.get_my_evidence_assignments()
from public, anon;
revoke all on function public.get_my_evidence_assignment_detail(uuid)
from public, anon;
revoke all on function public.start_my_evidence_review(uuid)
from public, anon;

grant execute on function public.get_available_evidence_checkers(uuid)
to authenticated;
grant execute on function public.get_officer_evidence_assignments(uuid)
to authenticated;
grant execute on function public.assign_evidence_to_checker(uuid, uuid)
to authenticated;
grant execute on function public.get_my_evidence_assignments()
to authenticated;
grant execute on function public.get_my_evidence_assignment_detail(uuid)
to authenticated;
grant execute on function public.start_my_evidence_review(uuid)
to authenticated;

notify pgrst, 'reload schema';
