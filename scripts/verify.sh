#!/usr/bin/env bash
# <!-- AGENT: DEVOPS -->
set -euo pipefail

echo "=== Running TypeScript Type Check ==="
npm run typecheck

echo "=== Running ESLint ==="
npm run lint

echo "=== Applying Local Supabase Migrations ==="
supabase db push --local --yes

echo "=== Running Supabase Database Lint ==="
supabase db lint --local --level warning --fail-on warning

echo "=== Running Integration Tests ==="
npm run test:integration:lookup
npm run test:integration:onboarding
npm run test:integration:authorization
npm run test:integration:connect-forms
npm run test:integration:webhooks
npm run test:integration:photos
npm run test:integration:events

echo "=== Running Production Build ==="
npm run build

echo "=== All checks passed! ==="
