# People workspace redesign

The redesign is based on the approved performance commit `37b88f8201bc1b28c9483ac51a2d95640ab2f33e` from [PR #46](https://github.com/HarvestGen-Dev/People/pull/46). The prototype supplies visual direction. Its example records and metrics are not part of the application.

Review the work in phases:

1. **Workspace and directory.** The light shell, mobile navigation, and shared page and panel styles serve the existing admin routes. The People form submits URL filters to the existing directory query, with a small client component to debounce typing. Pagination is server rendered. The preview reads the selected person from the current tenant-scoped page, uses the existing signed photo, and opens in a native dialog. Full profile, edit, add, and duplicate review still have their own routes.
2. **Overview and Follow-ups.** Overview uses existing metrics and shows real recent people, overdue follow-ups, pending registrations, and activity. The Follow-ups route adds paged Open and Completed views, with a separate Workflow boards view for the existing Kanban experience. The completion button calls the same authorized endpoint as the board.
3. **Events, lists, settings, and profile screens.** Events with pending registrations are prioritized for managers. Lists distinguish rule-based and hand-selected audiences and use the existing create and delete routes. Settings retains the role-gated navigation. The profile and form changes leave the existing notes, custom fields, and photo operations in place.

## Verify locally

Use a disposable Supabase instance with the repository migrations applied. Set the app's local Supabase URL and keys and export `TEST_DATABASE_URL` for the same instance before running browser tests. The operational-health test temporarily revokes and restores an RPC grant on that database.

```sh
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm run test:integration:performance
npm run test:e2e
npm run build
```

The redesign browser tests cover tenant-scoped search, status and tag filters, pagination, preview focus and permissions, workflow completion and board access, event review, list actions, and layout at 375, 390, 768, 1024, and 1440 px. The existing suites cover person creation, registration approvals, and administrative access.

Use an authenticated Lighthouse run on the production build for lab measurements. Confirm the handoff's 75th-percentile LCP, CLS, and INP targets with real-user data once the redesign reaches users.
