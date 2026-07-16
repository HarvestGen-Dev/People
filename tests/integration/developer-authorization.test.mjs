// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import {
  startNextDevServer,
  waitForNextDevServer,
} from './next-test-server.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.AUTHORIZATION_TEST_PORT ?? 3111);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';
const roles = ['owner', 'admin', 'pastoral', 'workflow_manager', 'staff', 'viewer', 'member'];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch },
    realtime: { transport: ws },
  }
);

let server;
let churchId;
let portalUserId;
const userIds = [];
const cookiesByRole = new Map();

async function sessionCookie(email) {
  const cookieStore = new Map();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
        },
        setAll(cookies) {
          cookies.forEach((cookie) => cookieStore.set(cookie.name, cookie.value));
        },
      },
      global: { fetch: fetch },
      realtime: { transport: ws },
    }
  );
  await authClient.auth.signInWithPassword({ email, password });
  cookieStore.set('people_church_id', churchId);
  return Array.from(cookieStore.entries())
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
}

async function requestDeveloperApi(role, path, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookie = cookiesByRole.get(role);
  if (cookie) headers.set('Cookie', cookie);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

before(async () => {
  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({
      slug: `authz-test-${suffix}`,
      name: `Authorization Test ${suffix}`,
    })
    .select('id')
    .single();
  if (churchError) throw churchError;
  churchId = church.id;

  for (const role of roles) {
    const email = `${role}-${suffix}@test.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    const { error: membershipError } = await admin
      .from('church_memberships')
      .insert({ church_id: churchId, user_id: data.user.id, role });
    if (membershipError) throw membershipError;
    cookiesByRole.set(role, await sessionCookie(email));
  }

  const portalEmail = `portal-${suffix}@test.com`;
  const { data: portalAuth, error: portalAuthError } = await admin.auth.admin.createUser({
    email: portalEmail,
    password,
    email_confirm: true,
  });
  if (portalAuthError) throw portalAuthError;
  portalUserId = portalAuth.user.id;
  userIds.push(portalUserId);
  cookiesByRole.set('portal', await sessionCookie(portalEmail));

  server = startNextDevServer({ port });
  await waitForNextDevServer({ server, baseUrl });
});

after(async () => {
  if (churchId) await admin.from('churches').delete().eq('id', churchId);
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  if (server?.process && !server.process.killed) {
    server.process.kill('SIGTERM');
  }
});

test('developer tool APIs are restricted to owner and admin roles', async () => {
  for (const role of roles) {
    const response = await requestDeveloperApi(role, '/api/admin/webhooks');
    if (role === 'owner' || role === 'admin') {
      assert.equal(response.status, 200, `${role} should access webhook list`);
    } else {
      assert.equal(response.status, 403, `${role} should not access webhook list`);
    }
  }

  const portalResponse = await requestDeveloperApi('portal', '/api/admin/webhooks');
  assert.equal(portalResponse.status, 403);

  const anonymousResponse = await fetch(`${baseUrl}/api/admin/webhooks`);
  assert.equal(anonymousResponse.status, 401);
});

test('developer tool mutations reject non-owner-admin actors', async () => {
  const payload = {
    name: `Authz key ${suffix}`,
    scopes: ['people:lookup'],
  };

  for (const role of roles) {
    const response = await requestDeveloperApi(role, '/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (role === 'owner' || role === 'admin') {
      assert.equal(response.status, 200, `${role} should create API keys`);
    } else {
      assert.equal(response.status, 403, `${role} should not create API keys`);
    }
  }

  const apiKeyLikeResponse = await fetch(`${baseUrl}/api/admin/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer people_k1_not_admin_session',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  assert.equal(apiKeyLikeResponse.status, 401);
});
