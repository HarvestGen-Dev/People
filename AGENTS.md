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

---

## Git Workflow

For every feature, fix, or documentation change:
1. Start from the intended base branch, usually `main`, and create a dedicated branch before editing.
2. Use branch names that match the existing repository style, such as `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>`.
3. Keep commits scoped to the current task. Do not stage unrelated user or agent changes.
4. Use the existing Conventional Commit message format, such as `feat: ...`, `fix: ...`, or `chore: ...`.
5. Run the relevant checks before committing when practical.
6. Commit the completed work, push the branch to `origin`, and leave the completed branch checked out with a clean working tree.
