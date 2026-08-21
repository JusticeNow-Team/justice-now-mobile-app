-- =========================================================
-- JusticeNow: Roles and Permissions Database Seed & Schema
-- =========================================================

-- 1. Create custom role enum if not existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM (
            'reporter',
            'case_officer',
            'evidence_checker',
            'system_admin'
        );
    END IF;
END$$;

-- 2. Create Roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    is_staff BOOLEAN DEFAULT FALSE,
    default_route TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Role Permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission)
);

-- 4. Seed the four system roles
INSERT INTO public.roles (id, name, label, description, is_staff, default_route)
VALUES
    ('reporter', 'Reporter', 'Public Reporter', 'Submits human rights reports and tracks personal cases safely.', false, '/reporter'),
    ('case_officer', 'Case Officer', 'Case Investigator / Officer', 'Reviews and investigates assigned cases.', true, '/officer'),
    ('evidence_checker', 'Evidence Checker', 'Evidence Checker / Validator', 'Examines and validates submitted case evidence.', true, '/checker'),
    ('system_admin', 'System Admin', 'System Administrator', 'Manages system security, roles, users, and audits.', true, '/admin')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_staff = EXCLUDED.is_staff,
    default_route = EXCLUDED.default_route;

-- 5. Seed Permissions for the 4 roles
INSERT INTO public.role_permissions (role_id, permission)
VALUES
    -- Reporter permissions
    ('reporter', 'cases:create'),
    ('reporter', 'cases:read:own'),
    ('reporter', 'evidence:upload:own'),
    ('reporter', 'evidence:read:own'),
    ('reporter', 'profile:read:own'),
    ('reporter', 'profile:update:own'),
    ('reporter', 'profile:security:manage'),

    -- Case Officer permissions
    ('case_officer', 'cases:read:assigned'),
    ('case_officer', 'cases:read:all'),
    ('case_officer', 'cases:update:status'),
    ('case_officer', 'cases:request_info'),
    ('case_officer', 'evidence:read:assigned'),
    ('case_officer', 'evidence:read:all'),
    ('case_officer', 'evidence:assign'),
    ('case_officer', 'profile:read:own'),
    ('case_officer', 'profile:update:own'),
    ('case_officer', 'profile:security:manage'),

    -- Evidence Checker permissions
    ('evidence_checker', 'cases:read:assigned'),
    ('evidence_checker', 'evidence:read:assigned'),
    ('evidence_checker', 'evidence:read:all'),
    ('evidence_checker', 'evidence:validate'),
    ('evidence_checker', 'profile:read:own'),
    ('evidence_checker', 'profile:update:own'),
    ('evidence_checker', 'profile:security:manage'),

    -- System Admin permissions
    ('system_admin', 'cases:read:all'),
    ('system_admin', 'cases:delete'),
    ('system_admin', 'evidence:read:all'),
    ('system_admin', 'evidence:validate'),
    ('system_admin', 'admin:users:read'),
    ('system_admin', 'admin:users:manage'),
    ('system_admin', 'admin:roles:manage'),
    ('system_admin', 'admin:audit_logs:read'),
    ('system_admin', 'admin:system:configure'),
    ('system_admin', 'profile:read:own'),
    ('system_admin', 'profile:update:own'),
    ('system_admin', 'profile:security:manage')
ON CONFLICT (role_id, permission) DO NOTHING;
