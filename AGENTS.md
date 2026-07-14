# AGENTS.md — People (HarvestGen Church OS)

## Agent Definitions

### ARCHITECT
**Trigger:** Any question about schema changes, new tables, API contract changes, or adding new modules.
**Responsibility:** Guards SPEC.md. Any structural change must be proposed with a rationale and a migration file before code is written. Never mutates existing columns without a migration.

### BACKEND
**Trigger:** Route Handlers (`/app/api/v1/`), lib utilities, Supabase queries, API key logic, webhook dispatch.
**Responsibility:** All server-side logic. Owns `src/lib/api-auth.ts`, `src/lib/webhooks.ts`, and all `/api/v1/` routes. Never leaks service role key to client.

### FRONTEND
**Trigger:** React components, Tailwind styling, shadcn/ui composition, client-side form handling.
**Responsibility:** Builds the admin UI. Reads data via Server Components. Uses Route Handlers for mutations. Follows the design language in SPEC.md exactly (palette, typography, border radius).

### INTEGRATION
**Trigger:** Anything involving Shepherd (LMS) or Drip & Brew (Café POS) connecting to People.
**Responsibility:** Documents the API contract for each connected system. Writes integration test payloads. Ensures the `/lookup` endpoint handles all edge cases (duplicate emails, phone-only matches, new visitor creation).

### DEVOPS
**Trigger:** Vercel config, environment variables, Supabase migration files, DNS setup.
**Responsibility:** Manages deployment config. All secrets in Vercel environment variables, never hardcoded. Migration files are sequential (`001_`, `002_`, etc.) and never destructive without a rollback plan.

---

## Agent Handoff Protocol

When a task spans multiple agents (e.g. adding a new API endpoint AND a UI for it):
1. ARCHITECT reviews schema impact first.
2. BACKEND writes the Route Handler and returns a curl test command.
3. FRONTEND builds the UI component that calls the route.
4. INTEGRATION documents how Shepherd/Drip & Brew would use the new endpoint if relevant.

Each agent signs their output section with `<!-- AGENT: NAME -->` in code comments so it's clear who owns what.

## Branch, Commit, Push, and PR Protocol

For every feature, fix, chore, or audit:
1. Create a dedicated branch from `main` before making changes.
2. Commit using the existing conventional format, for example `feat: ...`, `fix: ...`, `chore: ...`, or `test: ...`.
3. Push the completed branch to origin.
4. After every successful push, generate a PR message that follows `.github/pull_request_template.md` exactly. Fill in the Description, Type of Change, Related Issues, Changes Made, Screenshots / Recordings, Testing, and Checklist sections based on the actual diff and verification commands run.
