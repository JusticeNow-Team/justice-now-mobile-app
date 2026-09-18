# JusticeNow

JusticeNow is an Expo and Supabase application for reporting, investigating, and reviewing human-rights cases. It supports public reporters, case officers, evidence validators, and system administrators through role-specific workspaces.

## Tech Stack

- Expo SDK 57 with Expo Router
- React 19 and React Native 0.86
- TypeScript
- Supabase Auth, Postgres, Storage, RPC functions, and Edge Functions
- Lucide React Native icons

## Main Workspaces

- Reporter: register, submit cases, upload evidence, respond to information requests, request case withdrawal, and track case progress.
- Case Officer: review assigned cases, manage investigation status, request more information, assign evidence for validation, and act on evidence decisions.
- Evidence Validator: review assigned evidence, inspect metadata, record verification decisions, and view validation history.
- System Admin: manage staff accounts, roles, categories, audit logs, security settings, and operational alerts.

## Project Structure

```text
src/app/                  Expo Router routes
src/auth/                 roles, permissions, auth context, route guards
src/reporter/             reporter registration, login, cases, evidence, profile
src/app/officer/          case officer routes and screens
src/evidence-validator/   validator dashboard, queue, detail, decision screens
src/admin/                admin screens and dashboard surfaces
src/staff/                staff account types, validation, services, tests
src/audit/                audit event models and services
scripts/seeds/            Supabase schema and seed SQL
supabase/functions/       Supabase Edge Functions
```

## Prerequisites

- Node.js and npm
- Expo CLI through `npx expo`
- A Supabase project with Auth, Postgres, and Storage enabled
- Android Studio, Xcode, Expo Go, or a development build depending on the target device

This project is pinned to Expo SDK 57. Use the versioned Expo docs for SDK-specific changes: https://docs.expo.dev/versions/v57.0.0/

## Environment Setup

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_EVIDENCE_BUCKET=case-evidence
```

The app will fail fast if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing.

For the `admin-staff` Supabase Edge Function, configure these server-side secrets in Supabase:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never commit service role keys or local `.env` files.

## Install and Run

```bash
npm install
npm run start
```

Common targets:

```bash
npm run android
npm run ios
npm run web
```

## Database and Seeds

Seed files live in `scripts/seeds/` and should be applied in numeric order:

```text
001_roles_and_permissions.sql
002_report_categories.sql
003_staff_management_and_audit.sql
004_module_permissions_enforcement.sql
005_audit_events_immutable.sql
006_evidence_assignment.sql
007_case_withdrawal_review.sql
```

These scripts define roles, permissions, categories, staff management, audit controls, evidence assignment and validation workflows, and case withdrawal review support.

## Authentication Notes

Reporter login uses the public login flow. Staff and admin users sign in through the Staff & Admin Portal at `/secure-role`.

Staff MFA is currently temporarily disabled for local/project testing. The switch is in:

```ts
src/auth/mfa.ts
```

Set `STAFF_MFA_TEMPORARILY_DISABLED` to `false` to re-enable authenticator verification for staff and admin workspaces.

## Useful Scripts

```bash
npm test
npm run test:evidence-assignment
npm run test:withdrawal-review
npm run lint
npx tsc --noEmit
```

Current note: the targeted changed-file lint can pass, and `npm test` passes. Full-project `npm run lint` and `npx tsc --noEmit` may report existing unrelated issues in reporter/admin screens and Supabase Edge Function Deno typings.

## Testing

The test suite covers role models, permissions, dashboard routing, staff management, module permission boundaries, audit logging, evidence assignment contracts, and withdrawal review contracts.

Run all tests:

```bash
npm test
```

## Storage

Evidence files use the Supabase Storage bucket configured by `EXPO_PUBLIC_EVIDENCE_BUCKET`, defaulting to `case-evidence`. Keep this bucket private and use signed URLs for evidence access.

## Development Notes

- Keep role route boundaries aligned with `src/auth/navigation.ts`.
- Add new role permissions through the central auth permission matrix and matching seed SQL.
- Prefer Supabase RPC functions for cross-table workflow operations that need database-side authorization.
- Keep sensitive evidence and reporter data behind role checks and active account checks.
- When changing Expo APIs or configuration, check the SDK 57 docs first.
