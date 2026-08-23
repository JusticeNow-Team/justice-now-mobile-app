-- =====================================================================
-- JusticeNow Database Migration 002: Report Categories
-- Jira Task: JN-135 (Subtasks JN-136, JN-137)
-- =====================================================================

-- 1. Create the report_categories table
CREATE TABLE IF NOT EXISTS public.report_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    hint VARCHAR(256),
    icon VARCHAR(32) DEFAULT '📋',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_report_categories_code UNIQUE (code),
    CONSTRAINT uq_report_categories_name UNIQUE (name)
);

-- 2. Create case-insensitive unique indexes to prevent duplicate category names
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_categories_name_lower
    ON public.report_categories (LOWER(TRIM(name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_categories_code_lower
    ON public.report_categories (LOWER(TRIM(code)));

-- Index for fast active category filtering (Acceptance Criteria 3 & Subtask JN-140)
CREATE INDEX IF NOT EXISTS idx_report_categories_active_order
    ON public.report_categories (is_active, display_order);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;

-- Allow anyone authenticated or public to read active categories
CREATE POLICY "Allow public read active categories"
    ON public.report_categories
    FOR SELECT
    USING (is_active = TRUE);

-- Allow System Admins full access (read, insert, update, delete)
CREATE POLICY "Allow system_admin manage categories"
    ON public.report_categories
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'system_admin'
        )
    );

-- 4. Seed Initial Categories (Subtask JN-137)
INSERT INTO public.report_categories (code, name, description, hint, icon, is_active, display_order)
VALUES
    ('unlawful_detention', 'Unlawful Detention', 'Being held in custody, arrested, or detained without lawful authority, due process, or judicial review.', 'Being held without lawful reason or process', '⛓️', TRUE, 1),
    ('discrimination', 'Discrimination', 'Unfair treatment or denial of rights based on ethnicity, religion, gender, sexual orientation, disability, or social status.', 'Unfair treatment based on who you are', '⚖️', TRUE, 2),
    ('violence_or_abuse', 'Violence or Abuse', 'Physical assault, excessive use of force by authorities, torture, cruel, inhuman, or degrading treatment.', 'Physical harm, threats or ill-treatment', '🛡️', TRUE, 3),
    ('harassment', 'Harassment & Intimidation', 'Repeated stalking, digital harassment, surveillance, extortion, or threats aimed at silencing individuals.', 'Repeated unwanted behaviour or intimidation', '⚠️', TRUE, 4),
    ('freedom_of_expression', 'Freedom of Expression Violation', 'Suppression of free speech, peaceful assembly, press freedom, censorship, or unlawful confiscation of reporting equipment.', 'Being stopped from speaking or assembling', '📢', TRUE, 5),
    ('workplace_rights', 'Workplace Rights Violation', 'Forced labor, hazardous working conditions, withholding of wages, union busting, or child labor.', 'Unsafe, unpaid or unfair working conditions', '🏭', TRUE, 6),
    ('child_rights', 'Child Rights Violation', 'Harm, exploitation, neglect, denial of education, or abuse affecting minors and children.', 'Harm or denial of rights affecting a child', '🧸', TRUE, 7),
    ('gender_based_violence', 'Gender-Based Violence', 'Violence, assault, coercive control, or domestic abuse inflicted against individuals based on gender identity.', 'Harm or abuse directed against a person based on gender', '💜', TRUE, 8),
    ('health_basic_services', 'Right to Health & Basic Services', 'Denial of emergency medical care, clean water, essential shelter, or discriminatory access to public relief.', 'Deprivation of essential healthcare, water, or shelter', '🏥', TRUE, 9),
    ('other', 'Other Human Rights Violation', 'Other incidents or rights violations not specifically listed in the predefined categories above.', 'Something not listed here', '📋', TRUE, 10)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hint = EXCLUDED.hint,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();
