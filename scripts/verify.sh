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

echo "=== Running Unit Tests ==="
npm run test:unit

echo "=== Running Integration Tests ==="
npm run test:integration:lookup
npm run test:integration:onboarding
npm run test:integration:single-church
npm run test:integration:authorization
npm run test:integration:connect-forms
npm run test:integration:hg-link
npm run test:integration:webhooks
npm run test:integration:photos
npm run test:integration:tenant-fks
npm run test:integration:tenant-foreign-keys
npm run test:integration:events
npm run test:integration:missing-persons-cron
npm run test:integration:operational-observability

echo "=== Running End-to-End Tests ==="
npm run test:e2e
npm run test:e2e:single-church

echo "=== Running Production Build ==="
npm run build

echo "=== All checks passed! ==="
