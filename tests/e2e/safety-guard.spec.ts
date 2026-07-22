// <!-- AGENT: INTEGRATION -->
import { expect, test } from '@playwright/test';
import { assertSafeE2EEnvironment } from './helpers/supabase-admin';

test('destructive E2E setup refuses an unintended remote Supabase project', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalOverride = process.env.E2E_ALLOW_REMOTE_SUPABASE;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://production-ref.supabase.co';
    delete process.env.E2E_ALLOW_REMOTE_SUPABASE;
    expect(() => assertSafeE2EEnvironment()).toThrow(/Refusing to run destructive E2E setup/);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalOverride === undefined) delete process.env.E2E_ALLOW_REMOTE_SUPABASE;
    else process.env.E2E_ALLOW_REMOTE_SUPABASE = originalOverride;
  }
});
