-- =========================================================
-- JN: System-wide case messaging and message notifications
-- =========================================================
-- Run after 006_evidence_assignment.sql, 010_anonymous_instant_messages.sql,
-- and 012_admin_case_assignments.sql.

alter table public.case_messages
add column if not exists evidence_id uuid references public.case_evidence(id) on delete set null;

alter table public.case_messages
add column if not exists recipient_id uuid references public.profiles(id) on delete set null;

alter table public.case_messages
add column if not exists recipient_role text;

alter table public.case_messages
add column if not exists conversation_type text not null default 'reporter_officer'
  check (conversation_type in ('reporter_officer', 'officer_checker'));

create index if not exists case_messages_case_evidence_created_idx
on public.case_messages (case_id, evidence_id, created_at desc);

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and check_clause like '%sender_role%'
      and check_clause like '%case_officer%'
      and check_clause not like '%evidence_checker%'
  loop
    execute format(
      'alter table public.case_messages drop constraint if exists %I',
      constraint_record.constraint_name
    );
  end loop;
end;
$$;

alter table public.case_messages
drop constraint if exists case_messages_sender_role_check;

alter table public.case_messages
add constraint case_messages_sender_role_check
check (sender_role in ('reporter', 'case_officer', 'evidence_checker', 'system_admin'));

alter table public.case_messages
drop constraint if exists case_messages_recipient_role_check;

alter table public.case_messages
add constraint case_messages_recipient_role_checka
check (
  recipient_role is null
  or recipient_role in ('reporter', 'case_officer', 'evidence_checker', 'system_admin')
);

create table if not exists public.officer_notifications (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  notification_type text not null default 'case_update',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.officer_notifications
add column if not exists message_id uuid references public.case_messages(id) on delete cascade;

alter table public.officer_notifications
add column if not exists evidence_id uuid references public.case_evidence(id) on delete set null;

alter table public.officer_notifications
add column if not exists assignment_id uuid references public.evidence_assignments(id) on delete set null;

alter table public.officer_notifications
drop constraint if exists officer_notifications_notification_type_check;

alter table public.officer_notifications
drop constraint if exists officer_notification_type_check;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and check_clause like '%notification_type%'
      and check_clause like '%case_update%'
      and check_clause not like '%evidence_message%'
  loop
    execute format(
      'alter table public.officer_notifications drop constraint if exists %I',
      constraint_record.constraint_name
    );
  end loop;
end;
$$;

alter table public.officer_notifications
add constraint officer_notifications_notification_type_check
check (
  notification_type in (
    'case_assignment',
    'new_evidence',
    'evidence_verified',
    'evidence_rejected',
    'case_update',
    'case_message',
    'evidence_message',
    'security'
  )
);

create index if not exists officer_notifications_recipient_created_idx
on public.officer_notifications (officer_id, is_read, created_at desc);

alter table public.officer_notifications replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'officer_notifications'
  ) then
    alter publication supabase_realtime add table public.officer_notifications;
  end if;
end;
$$;

alter table public.officer_notifications enable row level security;

grant select, update on public.officer_notifications to authenticated;

drop policy if exists "Recipients can view own notifications" on public.officer_notifications;
create policy "Recipients can view own notifications"
on public.officer_notifications
for select
to authenticated
using (
  officer_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and viewer.is_active = true
  )
);

drop policy if exists "Recipients can update own notifications" on public.officer_notifications;
create policy "Recipients can update own notifications"
on public.officer_notifications
for update
to authenticated
using (officer_id = (select auth.uid()))
with check (officer_id = (select auth.uid()));

drop policy if exists "Authorized users can view case messages"
on public.case_messages;

create policy "Authorized users can view case messages"
on public.case_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and viewer.is_active = true
  )
  or (
    conversation_type = 'reporter_officer'
    and reporter_visible = true
    and exists (
      select 1
      from public.cases as reporter_case
      where reporter_case.id = case_messages.case_id
        and reporter_case.reporter_id = (select auth.uid())
    )
  )
  or exists (
    select 1
    from public.case_assignments as officer_assignment
    where officer_assignment.case_id = case_messages.case_id
      and officer_assignment.assigned_officer_id = (select auth.uid())
      and officer_assignment.is_active = true
  )
  or (
    conversation_type = 'officer_checker'
    and evidence_id is not null
    and exists (
      select 1
      from public.evidence_assignments as checker_assignment
      where checker_assignment.case_id = case_messages.case_id
        and checker_assignment.evidence_id = case_messages.evidence_id
        and checker_assignment.evidence_checker_id = (select auth.uid())
        and checker_assignment.status in ('assigned', 'under_review', 'completed')
    )
  )
);

drop function if exists public.get_my_case_messages(uuid);
drop function if exists public.get_my_case_messages(uuid, uuid);

create function public.get_my_case_messages(
  p_case_id uuid,
  p_evidence_id uuid default null
)
returns table (
  id uuid,
  case_id uuid,
  evidence_id uuid,
  sender_id uuid,
  sender_role text,
  recipient_id uuid,
  recipient_role text,
  conversation_type text,
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
    message.evidence_id,
    message.sender_id,
    message.sender_role,
    message.recipient_id,
    message.recipient_role,
    message.conversation_type,
    message.body,
    message.reporter_visible,
    message.created_at,
    message.read_at
  from public.case_messages message
  where message.case_id = p_case_id
    and (
      (p_evidence_id is null and message.conversation_type = 'reporter_officer')
      or (
        p_evidence_id is not null
        and message.conversation_type = 'officer_checker'
        and message.evidence_id = p_evidence_id
      )
    )
    and (
      exists (
        select 1
        from public.profiles viewer
        where viewer.id = auth.uid()
          and viewer.role::text = 'system_admin'
          and viewer.is_active = true
      )
      or (
        message.conversation_type = 'reporter_officer'
        and message.reporter_visible = true
        and exists (
          select 1
          from public.cases reporter_case
          where reporter_case.id = message.case_id
            and reporter_case.reporter_id = auth.uid()
        )
      )
      or exists (
        select 1
        from public.case_assignments officer_assignment
        where officer_assignment.case_id = message.case_id
          and officer_assignment.assigned_officer_id = auth.uid()
          and officer_assignment.is_active = true
      )
      or (
        message.conversation_type = 'officer_checker'
        and message.evidence_id is not null
        and exists (
          select 1
          from public.evidence_assignments checker_assignment
          where checker_assignment.case_id = message.case_id
            and checker_assignment.evidence_id = message.evidence_id
            and checker_assignment.evidence_checker_id = auth.uid()
            and checker_assignment.status in ('assigned', 'under_review', 'completed')
        )
      )
    )
  order by message.created_at asc;
$$;

drop function if exists public.send_case_message(uuid, text, boolean);
drop function if exists public.send_case_message(uuid, text, boolean, uuid);

create function public.send_case_message(
  p_case_id uuid,
  p_body text,
  p_reporter_visible boolean default true,
  p_evidence_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_sender_role text;
  v_message_id uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_case public.cases%rowtype;
  v_conversation_type text;
  v_recipient_id uuid;
  v_recipient_role text;
  v_notification_title text;
  v_notification_body text;
  v_assignment_id uuid;
  recipient_record record;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to send a case message.';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Messages must be between 1 and 2000 characters.';
  end if;

  select profiles.role::text
  into v_role
  from public.profiles
  where profiles.id = v_user_id
    and profiles.is_active = true;

  v_sender_role := case
    when v_role in ('evidence_checker', 'evidence_validator') then 'evidence_checker'
    else v_role
  end;

  if v_sender_role not in ('reporter', 'case_officer', 'evidence_checker', 'system_admin') then
    raise exception 'You are not allowed to send case messages.';
  end if;

  select *
  into v_case
  from public.cases
  where id = p_case_id;

  if v_case.id is null then
    raise exception 'This case could not be found.';
  end if;

  v_conversation_type := case
    when p_evidence_id is null then 'reporter_officer'
    else 'officer_checker'
  end;

  if v_conversation_type = 'reporter_officer' then
    if v_sender_role = 'reporter' and v_case.reporter_id is distinct from v_user_id then
      raise exception 'You can only message on your own cases.';
    end if;

    if v_sender_role = 'case_officer' and not exists (
      select 1
      from public.case_assignments
      where case_assignments.case_id = p_case_id
        and case_assignments.assigned_officer_id = v_user_id
        and case_assignments.is_active = true
    ) then
      raise exception 'You can only message on active assigned cases.';
    end if;

    if v_sender_role not in ('reporter', 'case_officer', 'system_admin') then
      raise exception 'Evidence Checkers can only message through assigned evidence threads.';
    end if;

    v_recipient_id := case when v_sender_role = 'reporter' then null else v_case.reporter_id end;
    v_recipient_role := case when v_sender_role = 'reporter' then 'case_officer' else 'reporter' end;
  else
    if not exists (
      select 1
      from public.case_evidence
      where case_evidence.id = p_evidence_id
        and case_evidence.case_id = p_case_id
    ) then
      raise exception 'This evidence item does not belong to the selected case.';
    end if;

    if v_sender_role = 'case_officer' and not exists (
      select 1
      from public.case_assignments
      where case_assignments.case_id = p_case_id
        and case_assignments.assigned_officer_id = v_user_id
        and case_assignments.is_active = true
    ) then
      raise exception 'You can only message Evidence Checkers on your assigned cases.';
    end if;

    if v_sender_role = 'evidence_checker' and not exists (
      select 1
      from public.evidence_assignments
      where evidence_assignments.case_id = p_case_id
        and evidence_assignments.evidence_id = p_evidence_id
        and evidence_assignments.evidence_checker_id = v_user_id
        and evidence_assignments.status in ('assigned', 'under_review', 'completed')
    ) then
      raise exception 'You can only message on evidence assigned to you.';
    end if;

    if v_sender_role not in ('case_officer', 'evidence_checker', 'system_admin') then
      raise exception 'Reporters cannot access internal evidence checker threads.';
    end if;

    if v_sender_role = 'case_officer' then
      select evidence_assignments.evidence_checker_id, evidence_assignments.id
      into v_recipient_id, v_assignment_id
      from public.evidence_assignments
      where evidence_assignments.case_id = p_case_id
        and evidence_assignments.evidence_id = p_evidence_id
        and evidence_assignments.status in ('assigned', 'under_review', 'completed')
      order by evidence_assignments.assigned_at desc
      limit 1;

      v_recipient_role := 'evidence_checker';
    else
      select case_assignments.assigned_officer_id
      into v_recipient_id
      from public.case_assignments
      where case_assignments.case_id = p_case_id
        and case_assignments.is_active = true
      order by case_assignments.assigned_at desc
      limit 1;

      v_recipient_role := 'case_officer';

      select evidence_assignments.id
      into v_assignment_id
      from public.evidence_assignments
      where evidence_assignments.case_id = p_case_id
        and evidence_assignments.evidence_id = p_evidence_id
        and evidence_assignments.evidence_checker_id = v_user_id
        and evidence_assignments.status in ('assigned', 'under_review', 'completed')
      order by evidence_assignments.assigned_at desc
      limit 1;
    end if;
  end if;

  insert into public.case_messages (
    case_id,
    evidence_id,
    sender_id,
    sender_role,
    recipient_id,
    recipient_role,
    conversation_type,
    body,
    reporter_visible
  )
  values (
    p_case_id,
    p_evidence_id,
    v_user_id,
    v_sender_role,
    v_recipient_id,
    v_recipient_role,
    v_conversation_type,
    v_body,
    case when v_conversation_type = 'reporter_officer' then p_reporter_visible else false end
  )
  returning id into v_message_id;

  if v_conversation_type = 'reporter_officer' and v_sender_role = 'reporter' then
    v_notification_title := 'New reporter message';
    v_notification_body := 'A Reporter sent a secure message on case ' || coalesce(v_case.case_reference, 'case') || '.';

    for recipient_record in
      select assigned_officer_id as recipient_id
      from public.case_assignments
      where case_id = p_case_id
        and is_active = true
    loop
      insert into public.officer_notifications (
        officer_id,
        case_id,
        message_id,
        notification_type,
        title,
        message
      )
      values (
        recipient_record.recipient_id,
        p_case_id,
        v_message_id,
        'case_message',
        v_notification_title,
        v_notification_body
      );
    end loop;
  elsif v_conversation_type = 'officer_checker' then
    v_notification_title := case
      when v_sender_role = 'case_officer' then 'New officer message'
      else 'New evidence checker message'
    end;
    v_notification_body := 'A secure evidence thread message was sent on case ' || coalesce(v_case.case_reference, 'case') || '.';

    if v_recipient_id is not null then
      insert into public.officer_notifications (
        officer_id,
        case_id,
        evidence_id,
        assignment_id,
        message_id,
        notification_type,
        title,
        message
      )
      values (
        v_recipient_id,
        p_case_id,
        p_evidence_id,
        v_assignment_id,
        v_message_id,
        'evidence_message',
        v_notification_title,
        v_notification_body
      );
    end if;
  end if;

  insert into public.case_timeline_events (
    case_id,
    event_type,
    title,
    description,
    actor_id,
    evidence_id,
    reporter_visible,
    metadata
  )
  values (
    p_case_id,
    'case_message',
    case
      when v_conversation_type = 'officer_checker' then 'Evidence thread message sent'
      else 'Secure message sent'
    end,
    case
      when v_sender_role = 'reporter' then 'Reporter sent a secure message.'
      when v_sender_role = 'evidence_checker' then 'Evidence Checker sent a secure message.'
      else 'Case Officer sent a secure message.'
    end,
    v_user_id,
    p_evidence_id,
    case when v_conversation_type = 'reporter_officer' and v_sender_role <> 'reporter' then p_reporter_visible else false end,
    jsonb_build_object(
      'message_id', v_message_id,
      'sender_role', v_sender_role,
      'recipient_id', v_recipient_id,
      'recipient_role', v_recipient_role,
      'conversation_type', v_conversation_type,
      'evidence_id', p_evidence_id
    )
  );

  return v_message_id;
end;
$$;

grant execute on function public.get_my_case_messages(uuid, uuid) to authenticated;
grant execute on function public.send_case_message(uuid, text, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
