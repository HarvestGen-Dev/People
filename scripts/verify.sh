#!/usr/bin/env bash
# <!-- AGENT: DEVOPS -->
set -euo pipefail

echo "=== Running TypeScript Type Check ==="
npm run typecheck

echo "=== Running ESLint ==="
npm run lint

echo "=== Running Supabase Database Lint ==="
supabase db lint --local --level warning --fail-on warning

echo "=== Running Integration Tests ==="
npm run test:integration:lookup
npm run test:integration:onboarding

echo "=== Running Production Build ==="
npm run build

echo "=== All checks passed! ==="
