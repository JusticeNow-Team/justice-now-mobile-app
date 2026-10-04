-- =========================================================
-- JN: Anonymous reporting, instant reporting, and case messages
-- =========================================================
-- Run after the core JusticeNow profile/case tables and 006 timeline script.

alter table public.cases
alter column reporter_id drop not null;

alter table public.cases
add column if not exists priority text not null default 'medium'
  check (priority in ('low', 'medium', 'high', 'urgent'));

alter table public.cases
add column if not exists submission_channel text not null default 'standard'
  check (submission_channel in ('standard', 'instant', 'anonymous', 'instant_anonymous'));

create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('reporter', 'case_officer', 'system_admin')),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  reporter_visible boolean not null default true,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists case_messages_case_created_idx
on public.case_messages (case_id, created_at desc);

alter table public.case_messages enable row level security;

grant select on public.case_messages to authenticated;

drop policy if exists "Authorized users can view case messages"
on public.case_messages;

create policy "Authorized users can view case messages"
on public.case_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = case_messages.case_id
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
      where reporter_case.id = case_messages.case_id
        and reporter_case.reporter_id = (select auth.uid())
    )
  )
);

create or replace function public.submit_reporter_case_v2(
  p_title text,
  p_description text,
  p_category text,
  p_incident_date text,
  p_district text,
  p_is_anonymous boolean default false,
  p_priority text default 'medium',
  p_submission_channel text default 'standard'
)
returns table (
  id uuid,
  case_reference text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_case_id uuid;
  v_reference text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required for identified reporter submissions.';
  end if;

  select * into v_profile
  from public.profiles
  where profiles.id = v_user_id
    and profiles.role::text = 'reporter'
    and profiles.is_active = true;

  if not found then
    raise exception 'Only an active Reporter can submit this case.';
  end if;

  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid case priority.';
  end if;

  if p_submission_channel not in ('standard', 'instant', 'anonymous', 'instant_anonymous') then
    raise exception 'Invalid submission channel.';
  end if;

  v_reference := 'JN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.cases (
    reporter_id,
    case_reference,
    title,
    description,
    category,
    incident_date,
    district,
    status,
    is_anonymous,
    priority,
    submission_channel
  )
  values (
    v_user_id,
    v_reference,
    trim(p_title),
    trim(p_description),
    trim(p_category),
    nullif(trim(p_incident_date), '')::date,
    nullif(trim(p_district), ''),
    'submitted',
    p_is_anonymous,
    p_priority,
    p_submission_channel
  )
  returning cases.id into v_case_id;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    actor_id,
    reporter_visible,
    metadata
  )
  values (
    v_case_id,
    'case_submitted',
    case when p_submission_channel = 'instant' then 'Instant report submitted' else 'Report submitted' end,
    'Reporter submitted the case securely.',
    v_user_id,
    true,
    jsonb_build_object('priority', p_priority, 'submission_channel', p_submission_channel)
  );

  return query
  select c.id, c.case_reference, c.created_at
  from public.cases c
  where c.id = v_case_id;
end;
$$;

create or replace function public.submit_anonymous_reporter_case(
  p_title text,
  p_description text,
  p_category text,
  p_incident_date text,
  p_district text,
  p_priority text default 'medium',
  p_submission_channel text default 'anonymous'
)
returns table (
  id uuid,
  case_reference text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_reference text;
begin
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid case priority.';
  end if;

  if p_submission_channel not in ('anonymous', 'instant_anonymous') then
    raise exception 'Anonymous reports must use an anonymous submission channel.';
  end if;

  v_reference := 'JN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.cases (
    reporter_id,
    case_reference,
    title,
    description,
    category,
    incident_date,
    district,
    status,
    is_anonymous,
    priority,
    submission_channel
  )
  values (
    null,
    v_reference,
    trim(p_title),
    trim(p_description),
    trim(p_category),
    nullif(trim(p_incident_date), '')::date,
    nullif(trim(p_district), ''),
    'submitted',
    true,
    p_priority,
    p_submission_channel
  )
  returning cases.id into v_case_id;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    reporter_visible,
    metadata
  )
  values (
    v_case_id,
    'case_submitted',
    case
      when p_submission_channel = 'instant_anonymous'
      then 'Instant anonymous report submitted'
      else 'Anonymous report submitted'
    end,
    'An anonymous reporter submitted the case securely.',
    false,
    jsonb_build_object('priority', p_priority, 'submission_channel', p_submission_channel)
  );

  return query
  select c.id, c.case_reference, c.created_at
  from public.cases c
  where c.id = v_case_id;
end;
$$;

create or replace function public.get_my_case_messages(p_case_id uuid)
returns table (
  id uuid,
  case_id uuid,
  sender_id uuid,
  sender_role text,
  body text,
  reporter_visible boolean,
  created_at timestamptz,
  read_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    message.id,
    message.case_id,
    message.sender_id,
    message.sender_role,
    message.body,
    message.reporter_visible,
    message.created_at,
    message.read_at
  from public.case_messages message
  where message.case_id = p_case_id
    and (
      exists (
        select 1
        from public.case_assignments officer_assignment
        where officer_assignment.case_id = message.case_id
          and officer_assignment.assigned_officer_id = auth.uid()
          and officer_assignment.is_active = true
      )
      or exists (
        select 1
        from public.profiles viewer
        where viewer.id = auth.uid()
          and viewer.role::text = 'system_admin'
          and viewer.is_active = true
      )
      or (
        message.reporter_visible = true
        and exists (
          select 1
          from public.cases reporter_case
          where reporter_case.id = message.case_id
            and reporter_case.reporter_id = auth.uid()
        )
      )
    )
  order by message.created_at asc;
$$;

create or replace function public.send_case_message(
  p_case_id uuid,
  p_body text,
  p_reporter_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to send a case message.';
  end if;

  select profiles.role::text into v_role
  from public.profiles
  where profiles.id = v_user_id
    and profiles.is_active = true;

  if v_role not in ('reporter', 'case_officer', 'system_admin') then
    raise exception 'You are not allowed to send case messages.';
  end if;

  if v_role = 'reporter' and not exists (
    select 1 from public.cases
    where cases.id = p_case_id
      and cases.reporter_id = v_user_id
  ) then
    raise exception 'You can only message on your own cases.';
  end if;

  if v_role = 'case_officer' and not exists (
    select 1 from public.case_assignments
    where case_assignments.case_id = p_case_id
      and case_assignments.assigned_officer_id = v_user_id
      and case_assignments.is_active = true
  ) then
    raise exception 'You can only message on active assigned cases.';
  end if;

  insert into public.case_messages (
    case_id,
    sender_id,
    sender_role,
    body,
    reporter_visible
  )
  values (
    p_case_id,
    v_user_id,
    v_role,
    trim(p_body),
    case when v_role = 'reporter' then true else p_reporter_visible end
  )
  returning id into v_message_id;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    actor_id,
    reporter_visible,
    metadata
  )
  values (
    p_case_id,
    'case_message',
    'Secure message sent',
    case when v_role = 'reporter' then 'Reporter sent a secure message.' else 'Staff sent a secure case message.' end,
    v_user_id,
    case when v_role = 'reporter' then false else p_reporter_visible end,
    jsonb_build_object('message_id', v_message_id, 'sender_role', v_role)
  );

  return v_message_id;
end;
$$;

grant execute on function public.submit_reporter_case_v2(text, text, text, text, text, boolean, text, text) to authenticated;
grant execute on function public.submit_anonymous_reporter_case(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_my_case_messages(uuid) to authenticated;
grant execute on function public.send_case_message(uuid, text, boolean) to authenticated;
