# HG Link

HG Link is the public connections hub for Harvest Generation Church, built into People.
It replaces the standalone `hg-connect/` static preview (removed).

## Architecture

```
Visitor ──► /link, /link/<church>            HgLinkHome (server) ──► hg_link_revisions (published)
        ──► /link/<church>/<form>            HgLinkFormPage ──► POST /api/public/connect-forms/<church>/<form>/submit
                                                                     │ validate against connect_forms.definition
                                                                     ▼
                                                      submit_connect_form(p_church_id, p_slug, …)  [one transaction]
                                                      identity lookup → safe merge → tag → workflow card → event → webhooks

Admin  ──► /settings/hg-link (page)          HgLinkEditor  ──► /api/admin/hg-link/page{,/publish,/restore}
       ──► /settings/hg-link/forms[/id]      FormBuilder   ──► /api/admin/hg-link/forms[/id{,/publish}]
       ──► /settings/hg-link/submissions     list + detail ──► /api/admin/hg-link/submissions/<id>
```

Key decisions

- **One renderer.** `src/components/hg-link/HgLinkHome.tsx` renders both the public page and the admin
  preview, so the preview cannot drift from what visitors see.
- **Revisions are JSON snapshots.** A page revision holds title, text, accent, layout and cards. Publish and
  restore are single SQL functions, so published content never changes while a draft is edited.
- **Data-only schemas.** `src/lib/hg-link/contentSchema.ts` and `formSchema.ts` (zod) are the only shapes the
  editor can store. There is no HTML, CSS or script input; colours and icons are keys into fixed tables in
  `components/hg-link/theme.ts`.
- **Reuse over rebuild.** Forms live in `connect_forms`; submissions in `connect_form_submissions`; tags and
  workflows use the existing columns and `workflow_cards`; audit uses `audit_log`; email uses the Brevo mailer.
- **Tenant scoping everywhere.** Public lookups use `(church_id, slug)`. Migration 050 fixed the earlier
  slug-only resolution. The legacy `/connect/<slug>` URL resolves only while the slug is unique across churches.

## Database (migrations 050–052)

| Object | Purpose |
| --- | --- |
| `submit_connect_form(p_church_id, …, p_answers, p_form_version)` | Transactional submission; tenant-scoped form lookup; stores answers |
| `resolve_unique_connect_form_church(slug)` | Legacy URL support, NULL if ambiguous |
| `hg_link_revisions` | Draft / published / archived page snapshots (one draft and one published per church) |
| `hg_link_save_draft`, `hg_link_publish`, `hg_link_restore` | Service-role functions; publish/restore take an advisory lock |
| `connect_forms.kind, definition, draft_definition, definition_version, notify_email` | Versioned form definition + routing |
| `connect_form_submissions.answers, form_version, follow_up_status, assigned_to, status_updated_*` | Form-specific answers and follow-up |

The anonymous "Public can view active connect forms" policy was dropped; public pages read server-side.
Rollback notes are at the top of `051_hg_link.sql`.

Migration 052 must ship with the updated publish Route Handler: the service-only
`hg_link_publish` RPC now requires `p_expected_content`, the exact saved JSON
validated by the server. A concurrent draft replacement returns `draft_changed`
(HTTP 409); publish and restore reject visible destinations whose forms are missing,
inactive, or belong to another church (HTTP 400). Failed operations preserve the live
revision. Rollback instructions are in `052_hg_link_publication_integrity.sql`.
Database failures and invalid saved content raise an error; built-in defaults are
used only when the church has no published revision.

## Roles

| Action | Roles |
| --- | --- |
| Edit/publish page and forms, create standard forms | owner, admin (platform admins act as owner) |
| View submissions, change status, assign | owner, admin, pastoral, workflow_manager |
| Everyone else | no access (staff, viewer, member) |

Checks are in the Route Handlers (`src/lib/hg-link/access.ts`); browser mutations also require a same-origin
`Origin` header. Assignees must be members of the same church with submission access.

## Administrative workflow

1. **Settings → HG Link → Forms → Set up standard forms** (once per church). Creates the four forms.
2. **Page tab**: edit the banner image address, welcome text, title, introduction, accent, layout,
   and up to 24 cards (title, description, button label, icon, colour, form or external website address;
   add, edit, hide, delete, reorder with the arrow buttons).
   The right pane previews unsaved edits (desktop or mobile). Banner images use a public HTTPS
   image address; incomplete addresses stay out of the preview until valid.
3. **Save draft** keeps edits private. **Publish changes** validates (cards must point to active forms in this
   church) and goes live. **Discard changes** drops the draft. **Restore** validates and republishes an earlier version.
   Editing pauses during saving and until the page refresh after publish/restore finishes, so a refresh
   cannot overwrite the next edit.

## Form publishing

Each form has a live `definition` and an optional `draft_definition`. Saving writes the draft; **Publish form**
copies it live and bumps `definition_version` (optimistic check). Each submission records the version it used.
Rules enforced on save: only the nine field types; unique ids; core fields (`first_name`, `last_name`,
`email`, `phone`, `birthdate`, `gender`) keep fixed types; first/last name stay visible and required; an email or
phone field stays visible. Connect Groups use `optionsSource: "lists"`, which offers this church's **static
People lists** (create one list per group). No hardcoded HG1–HG10.

## Submission processing

1. Origin check, form resolved by `(church_id, slug)`, body validated against the *published* definition
   (unknown/hidden keys dropped, option values checked, consent enforced).
2. RPC resolves identity with `lookup_or_create_person`; only empty profile fields are filled, conflicting values
   become `person_proposed_updates` for staff review. Idempotency key + body hash replay duplicates.
3. Core fields go to the person; everything else is stored in `answers` on the submission (not on the profile).
4. Optional tag, workflow card (never a second open card), `connect_form_submitted` event (no answers), webhooks.
5. Per-IP, per-church, per-form rate limit (10/hour). Response contains no answers.
6. If `notify_email` is set, an email with only the form title and a sign-in link is sent after the response
   (`after()`); failures are logged and never affect the submission.

## Configuration

- `PEOPLE_CHURCH_SLUG` — restricts this deployment to one church; Vercel deployments
  defaults to `harvestgen`. Other church URLs are unavailable in this mode.
- `HG_LINK_CHURCH_SLUG` — church served at `/link` when single-church mode is unset.
  In single-church mode, `/link` uses the deployment's church.
- `NEXT_PUBLIC_APP_URL`, `BREVO_SMTP_USER`, `BREVO_SMTP_KEY` — notification links and email (optional).
- No new secrets. Service-role key stays server-only.

## Local development and tests

```bash
supabase start && supabase db push --local --yes   # needs Docker
npm run dev                                         # /link/<church-slug>
npm run test:unit                                   # no database needed (Node 22.6+)
npm run test:integration:hg-link                    # needs local Supabase
npx playwright test tests/e2e/hg-link.spec.ts
npm run verify                                      # full gate, includes all of the above
```

Troubleshooting: `/link` 404 → `HG_LINK_CHURCH_SLUG` unset or wrong. A card 400s on publish → its form is missing
or inactive for that church. Connect Group dropdown empty → no static lists exist.

## Migration verification

PR [#48](https://github.com/HarvestGen-Dev/People/pull/48) merged the static preview's
replacement into People, including migration 051, the admin editor, and persisted forms.
Its original description still refers to a static preview; the code uses the backend
workflow above. Apply migrations through 052 before testing this follow-up.

The HG Link integration suite covers banner/description/link round-trips, private drafts,
publish and restore, concurrent edits, long history, malformed content, role checks and
tenant isolation. The browser suite also edits the banner, introduction and card destination,
reloads the draft, publishes it, discards later edits, and checks the visitor page.
These local checks do not establish whether a hosted database has the migrations applied.
