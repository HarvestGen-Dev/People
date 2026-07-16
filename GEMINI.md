# GEMINI.md — People (HarvestGen Church OS)

## Project Summary

People is a church member relationship management system for Harvest Generation Church (Malaysia). It is the central source of truth for all member data. Connected systems (Shepherd LMS, Drip & Brew Café POS) interact via a REST API authenticated with API keys.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth + Storage)

## Your Role

You are a senior full-stack engineer working on this project. You implement features described in sequential build prompts. You always read SPEC.md before writing any code.

## Core Rules

### TypeScript
- Strict mode. No `any`. Define all types in `src/lib/types.ts` first.
- Use `type` for object shapes, `interface` for component props.
- Always type Server Action and Route Handler return values.

### Next.js 16 App Router
- Server Components by default. Only add `'use client'` when you need state/effects.
- Data fetching via Server Components or Route Handlers — no `getServerSideProps`, no `getStaticProps`.
- Route Handlers in `/app/api/v1/` follow REST conventions from SPEC.md.
- Use Next.js `cookies()` for server-side Supabase client, not the browser client.

### Supabase
- Server-side always uses `createServerClient` from `@supabase/ssr` with `cookies()`.
- Browser client uses `createBrowserClient` from `@supabase/ssr`.
- Never use the service role key in client-side code. Service role is only for Route Handlers.
- All mutations go through Route Handlers or Server Actions — never direct Supabase calls from client components.
- Use `SUPABASE_SERVICE_ROLE_KEY` in API routes. Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Auth UI.

### API Authentication
- All `/api/v1/` routes use API key auth, not Supabase Auth sessions.
- API key validation logic lives in `src/lib/api-auth.ts`. Import and call it at the top of every Route Handler.
- Return `401` for missing/invalid key, `403` for valid key with insufficient scope.

### Styling
- Tailwind CSS only. No CSS modules. No inline styles.
- Use shadcn/ui components from `@/components/ui/`. Do not rewrite what shadcn provides.
- Sidebar background: `bg-slate-900`. Main content: `bg-gray-50`. Cards: `bg-white`.
- All user-facing text in sentence case. No ALL CAPS labels.

### File Conventions
- One component per file. Named export only (no default exports from component files).
- Component files: `PascalCase.tsx`
- Utility files: `camelCase.ts`
- Keep components under 200 lines. Extract sub-components when needed.

### Error Handling
- Route Handlers always return typed JSON: `{ data: T } | { error: string }`.
- Never throw unhandled exceptions. Catch at the handler level and return `500`.
- Client components use toast notifications (shadcn/ui `useToast`) for user-facing errors.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://people.harvestgen.org
```

## Do Not

- Do not add Prisma. Use Supabase client directly.
- Do not add React Query or SWR. Use Server Components + `router.refresh()`.
- Do not use `next/legacy/image`. Use `next/image`.
- Do not create additional Supabase tables outside of those defined in SPEC.md without noting the addition in a comment.
- Do not use `localStorage` for auth state. Supabase Auth uses cookies via `@supabase/ssr`.

## Verification Checklist (run after every prompt)

After completing each build prompt, verify:
- [ ] TypeScript compiles with `npx tsc --noEmit` (zero errors)
- [ ] `npm run dev` starts without errors
- [ ] No `any` types introduced
- [ ] All new environment variables documented in `.env.example`
- [ ] API routes tested with curl or Postman (include example curl command in response)
