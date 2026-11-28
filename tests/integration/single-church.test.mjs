// <!-- AGENT: INTEGRATION -->
// Run against local Supabase only; the server explicitly enables single-church mode.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import { startNextDevServer, waitForNextDevServer } from './next-test-server.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(supabaseUrl.hostname), 'Single-church fixtures require local Supabase');
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.SUPABASE_DB_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl).hostname), 'Fixture cleanup requires a local database');

const port = Number(process.env.SINGLE_CHURCH_TEST_PORT ?? 3124);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';
const admin = createClient(supabaseUrl.toString(), process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});
const churches = {};
const users = {};
const sessions = {};
const events = {};
const apiKeys = {};
let server;
let foreignInvitation;
const formSlug = `single-connect-${suffix}`;
const foreignFormSlug = `foreign-connect-${suffix}`;

async function insert(table, values, columns = '*') {
  const { data, error } = await admin.from(table).insert(values).select(columns).single();
  assert.ifError(error);
  return data;
}

async function createUser(key, churchKey, role) {
  const email = `${key}-single-${suffix}@test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    // Editable metadata must never grant a dashboard role.
    user_metadata: { church_slug: churches.a.slug, role: 'owner' },
  });
  assert.ifError(error);
  users[key] = data.user;
  if (churchKey) await insert('church_memberships', { church_id: churches[churchKey].id, user_id: data.user.id, role });
  const store = new Map();
  const client = createServerClient(supabaseUrl.toString(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => Array.from(store, ([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => store.set(name, value)),
    },
    realtime: { transport: ws },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signInError);
  sessions[key] = Array.from(store, ([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
}

async function request(path, { as, selectedChurch, body, method = 'GET', headers = {} } = {}) {
  const cookie = [as && sessions[as], selectedChurch && `people_church_id=${selectedChurch}`].filter(Boolean).join('; ');
  return fetch(`${baseUrl}${path}`, {
    method, redirect: 'manual',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(method === 'POST' ? { 'Idempotency-Key': crypto.randomUUID(), 'x-forwarded-for': '203.0.113.91' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Next.js may flush the page shell before a Server Component redirects or returns notFound().
async function assertPageRedirect(response, expectedPath) {
  if ([307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    assert.ok(location, 'redirect response must include Location');
    assert.equal(new URL(location, baseUrl).pathname, expectedPath);
    return;
  }
  assert.equal(response.status, 200);
  const html = await response.text();
  const hasRedirect = [307, 308].some((status) => html.includes(`NEXT_REDIRECT;replace;${expectedPath};${status};`));
  const hasRefresh = [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) =>
    /http-equiv="refresh"/i.test(tag) && [0, 1].some((delay) => tag.includes(`content="${delay};url=${expectedPath}"`)));
  assert.ok(hasRedirect || hasRefresh, `streamed page must explicitly redirect to ${expectedPath}`);
}

async function assertPageNotFound(response) {
  assert.ok([200, 404].includes(response.status), `expected not-found response, received ${response.status}`);
  const html = await response.text();
  if (response.status === 200) {
    assert.ok(html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), 'streamed page must explicitly signal notFound()');
  }
  return html;
}

before(async () => {
  for (const key of ['a', 'b']) {
    churches[key] = await insert('churches', { slug: `single-${key}-${suffix}`, name: `Single church ${key} ${suffix}` }, 'id, slug, name');
    await insert('connect_forms', {
      church_id: churches[key].id, slug: formSlug, title: `Connection form ${key}`, is_active: true,
    });
    await insert('hg_link_revisions', {
      church_id: churches[key].id, status: 'published', version: 1,
      content: { version: 1, title: `Connections for church ${key}`, cards: [] },
    });
    events[key] = await insert('events', {
      church_id: churches[key].id, slug: `single-event-${key}-${suffix}`, name: `Single church event ${key}`,
      start_at: new Date(Date.now() + 86_400_000).toISOString(), status: 'published', price: 20,
    }, 'id, slug');
    apiKeys[key] = `people_k1_${crypto.randomBytes(16).toString('hex')}`;
    await insert('api_keys', {
      church_id: churches[key].id, name: `Single church integration ${key}`, key_prefix: apiKeys[key].slice(0, 18),
      key_hash: crypto.createHash('sha256').update(apiKeys[key]).digest('hex'), scopes: ['people:read'], is_active: true,
    });
  }
  await insert('connect_forms', {
    church_id: churches.b.id, slug: foreignFormSlug, title: 'Foreign legacy form', is_active: true,
  });
  await createUser('ownerA', 'a', 'owner');
  await createUser('adminA', 'a', 'admin');
  await createUser('adminB', 'b', 'admin');
  await createUser('platform');
  await insert('platform_admins', { user_id: users.platform.id });
  await createUser('portal');
  await createUser('claimant');
  await createUser('foreignPortal');

  for (const key of ['a', 'b']) {
    const person = await insert('people', {
      church_id: churches[key].id, first_name: `Portal ${key}`, last_name: suffix,
      email: `portal-profile-${key}-${suffix}@test.invalid`, status: 'visitor',
    }, 'id');
    await insert('person_user_links', {
      church_id: churches[key].id, person_id: person.id, user_id: users.portal.id, claim_method: 'admin_approved',
    });
  }
  const foreignPerson = await insert('people', {
    church_id: churches.b.id, first_name: 'Foreign only', last_name: suffix,
    email: users.foreignPortal.email, status: 'visitor',
  }, 'id');
  await insert('person_user_links', {
    church_id: churches.b.id, person_id: foreignPerson.id, user_id: users.foreignPortal.id, claim_method: 'admin_approved',
  });
  await insert('people', {
    church_id: churches.a.id, first_name: 'Verified claimant', last_name: suffix,
    email: users.claimant.email, status: 'visitor', allow_self_claim: true,
  });
  foreignInvitation = crypto.randomBytes(32).toString('base64url');
  await insert('church_invitations', {
    church_id: churches.b.id, email: `invite-${suffix}@test.invalid`, role: 'admin',
    token_hash: crypto.createHash('sha256').update(foreignInvitation).digest('hex'),
    invited_by: users.platform.id, expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  server = startNextDevServer({ port, env: {
    PEOPLE_CHURCH_SLUG: churches.a.slug, HG_LINK_CHURCH_SLUG: '', VERCEL_ENV: '',
  } });
  await waitForNextDevServer({ server, baseUrl });
});

after(async () => {
  if (server?.process && !server.process.killed) server.process.kill('SIGTERM');
  const churchIds = Object.values(churches).map(({ id }) => {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    return `'${id}'::uuid`;
  });
  if (churchIds.length) {
    // Deleting submission fixtures must bypass append-only triggers in one rollback-safe transaction.
    const cleanup = spawnSync('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1'], {
      encoding: 'utf8',
      input: `BEGIN;
        ALTER TABLE public.person_events DISABLE TRIGGER person_events_append_only;
        ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_append_only;
        DELETE FROM public.churches WHERE id = ANY(ARRAY[${churchIds.join(',')}]);
        ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only;
        ALTER TABLE public.person_events ENABLE TRIGGER person_events_append_only;
        COMMIT;`,
    });
    assert.equal(cleanup.status, 0, cleanup.error?.message || cleanup.stderr || cleanup.stdout);
  }
  for (const user of Object.values(users)) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    assert.ifError(error);
  }
});

test('platform administrators enter the configured dashboard without selecting a church', async () => {
  const account = await request('/account', { as: 'platform' });
  await assertPageRedirect(account, '/dashboard');
  const dashboard = await request('/dashboard', { as: 'platform' });
  assert.equal(dashboard.status, 200);
  const html = await dashboard.text();
  assert.ok(html.includes('href="/people"'));
  assert.ok(!html.includes('href="/platform"'), 'single-church navigation must not expose the church selector');
  const platformPage = await request('/platform', { as: 'platform' });
  await assertPageRedirect(platformPage, '/dashboard');
});

test('a stale church cookie cannot move a platform administrator out of the configured church', async () => {
  const response = await request('/api/admin/invitations', { as: 'platform', selectedChurch: churches.b.id });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  const memberIds = data.members.map((member) => member.userId);
  assert.ok(memberIds.includes(users.ownerA.id) && memberIds.includes(users.adminA.id));
  assert.ok(!memberIds.includes(users.adminB.id));
});

test('configured church managers retain access and unrelated church accounts are refused', async () => {
  for (const as of ['ownerA', 'adminA']) {
    assert.equal((await request('/api/admin/invitations', { as })).status, 200);
  }
  for (const as of ['adminB', 'portal', 'claimant']) {
    assert.equal((await request('/api/admin/invitations', { as })).status, 403, as);
  }
  assert.equal((await request('/api/admin/invitations')).status, 401);
  const account = await request('/account', { as: 'adminB' });
  await assertPageRedirect(account, '/claim-pending');
  const pending = await request('/claim-pending', { as: 'adminB' });
  assert.equal(pending.status, 200);
  assert.ok((await pending.text()).includes('No imported profile found'), 'a foreign membership must not create a redirect loop');
});

test('church creation, switching and platform invitations are disabled without side effects', async () => {
  const attempts = [
    ['/api/platform/churches', { name: 'Unwanted church', slug: `unwanted-${suffix}` }],
    [`/api/platform/churches/${churches.b.id}/select`, {}],
    ['/api/platform/invitations', { church_id: churches.b.id, email: `blocked-${suffix}@test.invalid` }],
    ['/api/admin/invitations', { church_id: churches.b.id, email: `blocked-admin-${suffix}@test.invalid`, role: 'admin' }],
  ];
  for (const [path, body] of attempts) {
    const response = await request(path, { as: 'platform', method: 'POST', body });
    assert.equal(response.status, 403, path);
    assert.ok(!response.headers.get('set-cookie')?.includes('people_church_id='), 'blocked switching must not change the selected church');
  }
  const { count, error } = await admin.from('churches').select('id', { count: 'exact', head: true }).eq('slug', `unwanted-${suffix}`);
  assert.ifError(error);
  assert.equal(count, 0);
  const { count: invitations, error: invitationError } = await admin.from('church_invitations')
    .select('id', { count: 'exact', head: true }).in('email', [`blocked-${suffix}@test.invalid`, `blocked-admin-${suffix}@test.invalid`]);
  assert.ifError(invitationError);
  assert.equal(invitations, 0);
});

test('public link and connect pages expose only the configured church including the default link alias', async () => {
  for (const path of ['/link', `/link/${churches.a.slug}`, `/connect/${churches.a.slug}/${formSlug}`]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok(!(await response.text()).includes('Connections for church b'));
  }
  const defaultPage = await (await request('/link')).text();
  assert.ok(defaultPage.includes('Connections for church a'), '/link must use PEOPLE_CHURCH_SLUG without a separate HG Link slug');
  for (const path of [`/link/${churches.b.slug}`, `/link/${churches.b.slug}/${formSlug}`,
    `/connect/${churches.b.slug}/${formSlug}`, `/connect/${foreignFormSlug}`]) {
    const html = await assertPageNotFound(await request(path));
    assert.ok(!html.includes('Connections for church b'), path);
    assert.ok(!html.includes('Foreign legacy form'), path);
  }
});

test('foreign scoped and legacy form submissions are refused while configured submissions still work', async () => {
  const body = { first_name: 'Scoped', last_name: 'Visitor', email: `submission-${suffix}@test.invalid` };
  for (const path of [`/api/public/connect-forms/${churches.b.slug}/${formSlug}/submit`,
    `/api/public/connect-forms/${foreignFormSlug}/submit`]) {
    assert.equal((await request(path, { method: 'POST', body })).status, 404, path);
  }
  const allowed = await request(`/api/public/connect-forms/${churches.a.slug}/${formSlug}/submit`, { method: 'POST', body });
  assert.equal(allowed.status, 200);
  for (const key of ['a', 'b']) {
    const { count, error } = await admin.from('people').select('id', { count: 'exact', head: true })
      .eq('church_id', churches[key].id).eq('email', body.email);
    assert.ifError(error);
    assert.equal(count, key === 'a' ? 1 : 0);
  }
});

test('a valid invitation for another church is invalid on the configured deployment', async () => {
  const response = await request(`/signup?invite=${foreignInvitation}`);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('Invalid Invitation'));
});

test('public event pages, registrations and proof uploads refuse another church', async () => {
  assert.equal((await request(`/e/${events.a.slug}`)).status, 200);
  const foreignPage = await assertPageNotFound(await request(`/e/${events.b.slug}`));
  assert.ok(!foreignPage.includes('Single church event b'));
  const registration = await request(`/api/public/events/${events.b.id}/register`, {
    method: 'POST', body: { first_name: 'Foreign', last_name: 'Visitor', email: `event-${suffix}@test.invalid` },
  });
  assert.equal(registration.status, 404);
  const upload = await request(`/api/public/events/${events.b.id}/upload-proof`, { method: 'POST' });
  assert.equal(upload.status, 404);
  const { count, error } = await admin.from('event_registrations')
    .select('id', { count: 'exact', head: true }).eq('event_id', events.b.id);
  assert.ifError(error);
  assert.equal(count, 0);
});

test('API keys from another church cannot access the configured deployment', async () => {
  const foreign = await request('/api/v1/people', { headers: { Authorization: `Bearer ${apiKeys.b}` } });
  assert.equal(foreign.status, 401);
  const allowed = await request('/api/v1/people', { headers: { Authorization: `Bearer ${apiKeys.a}` } });
  assert.equal(allowed.status, 200);
  const { data } = await allowed.json();
  assert.ok(data.people.some((person) => person.first_name === 'Portal a'));
  assert.ok(!data.people.some((person) => person.first_name === 'Portal b'));
});

test('portal profiles and verified claims remain scoped without granting administrator membership', async () => {
  const portal = await request('/portal', { as: 'portal' });
  assert.equal(portal.status, 200);
  const html = await portal.text();
  assert.ok(html.includes(churches.a.name));
  assert.ok(!html.includes(churches.b.name));
  const foreignAccount = await request('/account', { as: 'foreignPortal' });
  await assertPageRedirect(foreignAccount, '/claim-pending');
  const foreignPortal = await request('/portal', { as: 'foreignPortal' });
  await assertPageRedirect(foreignPortal, '/claim-pending');
  const foreignPending = await request('/claim-pending', { as: 'foreignPortal' });
  assert.equal(foreignPending.status, 200);
  assert.ok((await foreignPending.text()).includes('No imported profile found'), 'a foreign profile link must not bounce back to the portal');

  const claimed = await request('/portal', { as: 'claimant' });
  assert.equal(claimed.status, 200);
  assert.ok((await claimed.text()).includes('Verified claimant'));
  const { data: links, error } = await admin.from('person_user_links').select('church_id').eq('user_id', users.claimant.id);
  assert.ifError(error);
  assert.deepEqual(links.map((link) => link.church_id), [churches.a.id]);
  const { count, error: membershipError } = await admin.from('church_memberships')
    .select('id', { count: 'exact', head: true }).in('user_id', [users.portal.id, users.claimant.id, users.foreignPortal.id]);
  assert.ifError(membershipError);
  assert.equal(count, 0);
  assert.equal((await request('/api/admin/invitations', { as: 'claimant' })).status, 403);
});
