# HG Link implementation report

Branch `feat/hg-link` (on top of PR #48). Not pushed from the environment where it was built unless noted in the PR.

## Delivered

- Public `/link`, `/link/<church>`, `/link/<church>/<form>` in React/Tailwind with the original palette, fonts and card layout.
- Admin editor (Settings → HG Link): text, accent, layout, hero image, cards (add/edit/hide/delete/reorder, internal form or external https URL), live desktop/mobile preview, save draft, publish, discard, restore.
- Form builder: nine field types, required/hidden, reorder, help text, success message, tag/workflow routing, notification inbox, draft → publish with versioning.
- Four standard forms (new to church fixed: two independent optional Yes/No; became a Christian with preferred contact + consent; water baptism with list-backed Connect Group; serve with ministry + availability).
- Submissions list (filter by form, status, assignee, date) and detail with status + assignment.
- Security fix: tenant-scoped form resolution (migration 050).
- `hg-connect/` retired; fonts moved to `src/components/hg-link/fonts/`.

## Files

New: `supabase/migrations/050_*.sql`, `051_hg_link.sql`; `src/lib/hg-link/*`, `src/lib/connectFormResolver.ts`, `src/lib/email/send-submission-notice.ts`;
`src/components/hg-link/*`; `src/app/link/**`; `src/app/(admin)/settings/hg-link/**`; `src/app/api/admin/hg-link/**`;
tests `tests/unit/hg-link-schema.test.ts`, `tests/integration/hg-link.test.mjs`, `tests/e2e/hg-link.spec.ts`; docs.
Changed: `src/lib/connectFormSubmit.ts` (was inside the route), public connect routes/pages, `src/proxy.ts` (public `/link`),
settings layout/nav, `tsconfig.json` (`allowImportingTsExtensions`), `package.json`, `scripts/verify.sh`, CI (Node 22), `.env.example`, README/AGENTS/GEMINI.
Removed: `hg-connect/`.

## Decisions

- Page revisions are validated JSON snapshots rather than a separate cards table: atomic publish/restore and no partial states. Trade-off: cards are not individually queryable.
- Connect Groups come from static People lists; no dedicated groups table existed.
- Restore publishes a new version cloned from an old one (history is never rewritten). Forms have draft/publish/version but no restore UI.
- Submission roles: owner, admin, pastoral, workflow_manager.

## Verification actually run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npx eslint src tests` | pass |
| `npm run test:unit` (9 tests: schemas, URL safety, validation, defaults) | pass |
| `npm run build` | pass |
| Migrations 050/051 on a database | **not run** (no Docker/Supabase CLI available) |
| `tests/integration/hg-link.test.mjs`, updated `connect-form-submission.test.mjs` | **not run** (need DB); syntax-checked only |
| `tests/e2e/hg-link.spec.ts` | **not run** (need DB) |
| Visual comparison with the old static site | **not done** |

CI runs `npm run verify` on the PR with a local Supabase stack; that is the first real execution of the SQL and
the integration/e2e tests. Treat failures there as expected-possible and fix before merging.

## Limitations

- Visitor email notifications to the submitter are not implemented; staff notification is optional and per form.
- Honeypot/CAPTCHA is not added; protection is origin check, idempotency and per-IP rate limiting.
- Cards cannot be drag-reordered (arrow buttons only, by design for accessibility).
- Form restore, per-ministry leader scoping of serve submissions, and a "People → HG Link" sidebar entry are not built; access is via Settings.
- Dropdown for the page hero image accepts a URL only (no upload).

## Production considerations

Apply 050 then 051 (050 drops the slug-only RPC; deploy app and migration together). Set `HG_LINK_CHURCH_SLUG`.
Old `/connect/<slug>` links keep working while slugs are unique. Create one static list per Connect Group.
051 removes anonymous SELECT on `connect_forms`; nothing in this repo used it.
