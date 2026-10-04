-- JN: Admin system settings persistence
-- Run after the core JusticeNow profile tables.

create table if not exists public.system_settings (
  id text primary key,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system_bootstrap'
);

alter table public.system_settings enable row level security;

grant select, insert, update on public.system_settings to authenticated;

drop policy if exists "System admins can view system settings"
on public.system_settings;

create policy "System admins can view system settings"
on public.system_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and coalesce(viewer.is_active, true) = true
      and coalesce(viewer.status::text, 'active') not in ('inactive', 'suspended')
  )
);

drop policy if exists "System admins can manage system settings"
on public.system_settings;

create policy "System admins can manage system settings"
on public.system_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and coalesce(viewer.is_active, true) = true
      and coalesce(viewer.status::text, 'active') not in ('inactive', 'suspended')
  )
)
with check (
  exists (
    select 1
    from public.profiles as viewer
    where viewer.id = (select auth.uid())
      and viewer.role::text = 'system_admin'
      and coalesce(viewer.is_active, true) = true
      and coalesce(viewer.status::text, 'active') not in ('inactive', 'suspended')
  )
);

insert into public.system_settings (
  id,
  settings_json,
  updated_at,
  updated_by
)
values (
  'global',
  '{
    "security": {
      "requireMfaForStaff": true,
      "sessionTimeoutMinutes": 15,
      "maxFailedLoginAttempts": 5,
      "passwordMinLength": 8
    },
    "evidence": {
      "blockEvidenceDownloads": true,
      "retentionPeriodYears": 7,
      "maxUploadSizeBytes": 104857600
    },
    "platform": {
      "maintenanceMode": false,
      "maintenanceNotice": "System undergoing scheduled maintenance. Please check back shortly.",
      "allowNewRegistrations": true,
      "systemAlertThreshold": "medium"
    }
  }'::jsonb,
  now(),
  'system_bootstrap'
)
on conflict (id) do nothing;
