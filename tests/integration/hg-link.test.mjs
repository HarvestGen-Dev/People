// <!-- AGENT: INTEGRATION -->
// HG Link: admin editing, publishing, tenant isolation, form submission, submission access.
// Requires the local Supabase stack and migrations through 051 (see docs/HG_LINK.md).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import { startNextDevServer, waitForNextDevServer } from './next-test-server.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.HG_LINK_TEST_PORT ?? 3113);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch },
  realtime: { transport: ws },
});

let server;
const churches = {};
const cookies = {};
const userIds = {};
const created = [];

async function sessionCookie(email, churchId) {
  const store = new Map();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach((c) => store.set(c.name, c.value)),
    },
    global: { fetch },
    realtime: { transport: ws },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  store.set('people_church_id', churchId);
  return Array.from(store.entries()).map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
}

async function api(method, path, { as, body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(as ? { cookie: cookies[as] } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

async function makeUser(key, churchKey, role) {
  const email = `${key}-${suffix}@test.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  userIds[key] = data.user.id;
  const { error: mError } = await admin.from('church_memberships').insert({ church_id: churches[churchKey].id, user_id: data.user.id, role });
  if (mError) throw mError;
  cookies[key] = await sessionCookie(email, churches[churchKey].id);
}

const content = (title) => ({
  version: 1, wordmark: 'Harvest Generation', title, description: '', accent: 'navy', layout: 'grid', heroImageUrl: null,
  cards: [{ id: 'serve', title: 'I Want To Serve', description: '', icon: 'none', theme: 'navy', buttonLabel: '', visible: true, destination: { type: 'form', formSlug: 'serve' } }],
});

before(async () => {
  for (const key of ['a', 'b']) {
    const { data, error } = await admin.from('churches').insert({ slug: `hg-${key}-${suffix}`, name: `HG ${key} ${suffix}` }).select('id, slug').single();
    if (error) throw error;
    churches[key] = data;
  }
  await makeUser('adminA', 'a', 'admin');
  await makeUser('pastoralA', 'a', 'pastoral');
  await makeUser('staffA', 'a', 'staff');
  await makeUser('viewerA', 'a', 'viewer');
  await makeUser('adminB', 'b', 'admin');
  server = startNextDevServer({ port, env: { HG_LINK_CHURCH_SLUG: churches.a.slug } });
  await waitForNextDevServer({ server, baseUrl });
});

after(async () => {
  for (const key of Object.keys(churches)) await admin.from('churches').delete().eq('id', churches[key].id);
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
  if (server?.process && !server.process.killed) server.process.kill('SIGTERM');
});

test('unauthenticated and under-privileged users cannot edit HG Link', async () => {
  const anon = await api('PUT', '/api/admin/hg-link/page', { body: { content: content('Nope') } });
  assert.ok([401, 403].includes(anon.status));
  for (const who of ['staffA', 'viewerA', 'pastoralA']) {
    const res = await api('PUT', '/api/admin/hg-link/page', { as: who, body: { content: content('Nope') } });
    assert.equal(res.status, 403, who);
    assert.equal((await api('POST', '/api/admin/hg-link/page/publish', { as: who })).status, 403, who);
    assert.equal((await api('POST', '/api/admin/hg-link/forms', { as: who })).status, 403, who);
  }
});

test('invalid content and unsafe external URLs are rejected server-side', async () => {
  const bad = content('Bad');
  bad.cards.push({ ...bad.cards[0], id: 'x', destination: { type: 'external', url: 'javascript:alert(1)' } });
  assert.equal((await api('PUT', '/api/admin/hg-link/page', { as: 'adminA', body: { content: bad } })).status, 400);
  const extra = { ...content('Extra'), html: '<script>x</script>' };
  assert.equal((await api('PUT', '/api/admin/hg-link/page', { as: 'adminA', body: { content: extra } })).status, 400);
  const cross = await api('PUT', '/api/admin/hg-link/page', {
    as: 'adminA', body: { content: content('X') }, headers: { Origin: 'https://evil.example' },
  });
  assert.equal(cross.status, 403);
});

test('draft, publish and restore keep the published page stable', async () => {
  assert.equal((await api('POST', '/api/admin/hg-link/forms', { as: 'adminA' })).status, 200);

  assert.equal((await api('PUT', '/api/admin/hg-link/page', { as: 'adminA', body: { content: content('Version one') } })).status, 200);
  const publicBefore = await (await fetch(`${baseUrl}/link/${churches.a.slug}`)).text();
  assert.ok(!publicBefore.includes('Version one'), 'draft must not be public');

  assert.equal((await api('POST', '/api/admin/hg-link/page/publish', { as: 'adminA' })).status, 200);
  assert.ok((await (await fetch(`${baseUrl}/link/${churches.a.slug}`)).text()).includes('Version one'));

  await api('PUT', '/api/admin/hg-link/page', { as: 'adminA', body: { content: content('Version two draft') } });
  assert.ok(!(await (await fetch(`${baseUrl}/link/${churches.a.slug}`)).text()).includes('Version two draft'));
  await api('POST', '/api/admin/hg-link/page/publish', { as: 'adminA' });

  const { data: revisions } = await admin.from('hg_link_revisions').select('id, version, status').eq('church_id', churches.a.id).order('version');
  const first = revisions.find((r) => r.version === 1);
  const restored = await api('POST', '/api/admin/hg-link/page/restore', { as: 'adminA', body: { revisionId: first.id } });
  assert.equal(restored.status, 200);
  assert.ok((await (await fetch(`${baseUrl}/link/${churches.a.slug}`)).text()).includes('Version one'));
  const { count } = await admin.from('hg_link_revisions').select('id', { count: 'exact', head: true }).eq('church_id', churches.a.id).eq('status', 'published');
  assert.equal(count, 1);
});

test('publishing is blocked when a card opens a missing form', async () => {
  const c = content('Broken');
  c.cards[0].destination = { type: 'form', formSlug: 'does-not-exist' };
  await api('PUT', '/api/admin/hg-link/page', { as: 'adminB', body: { content: c } });
  assert.equal((await api('POST', '/api/admin/hg-link/page/publish', { as: 'adminB' })).status, 400);
});

test('content and revisions are isolated per tenant', async () => {
  await api('PUT', '/api/admin/hg-link/page', { as: 'adminB', body: { content: content('Church B only') } });
  assert.ok(!(await (await fetch(`${baseUrl}/link/${churches.a.slug}`)).text()).includes('Church B only'));
  const { data: aRev } = await admin.from('hg_link_revisions').select('id').eq('church_id', churches.a.id).eq('status', 'archived').limit(1);
  const res = await api('POST', '/api/admin/hg-link/page/restore', { as: 'adminB', body: { revisionId: aRev[0].id } });
  assert.equal(res.status, 404);
  assert.equal((await fetch(`${baseUrl}/link/no-such-church-${suffix}`)).status, 404);
});

let serveFormId;
test('form builder: draft is private until published; invalid definitions are rejected', async () => {
  const { data: form } = await admin.from('connect_forms').select('id, definition, definition_version').eq('church_id', churches.a.id).eq('slug', 'serve').single();
  serveFormId = form.id;
  const settings = { title: 'I Want To Serve', description: '', isActive: true, targetTagId: null, targetWorkflowId: null, notifyEmail: null };

  const broken = structuredClone(form.definition);
  broken.fields = broken.fields.filter((f) => f.id !== 'first_name');
  assert.equal((await api('PUT', `/api/admin/hg-link/forms/${form.id}`, { as: 'adminA', body: { ...settings, definition: broken } })).status, 400);

  const edited = structuredClone(form.definition);
  edited.successMessage = 'Edited success message';
  assert.equal((await api('PUT', `/api/admin/hg-link/forms/${form.id}`, { as: 'adminA', body: { ...settings, definition: edited } })).status, 200);
  assert.ok(!(await (await fetch(`${baseUrl}/link/${churches.a.slug}/serve`)).text()).includes('Edited success message'));

  assert.equal((await api('POST', `/api/admin/hg-link/forms/${form.id}/publish`, { as: 'adminA' })).status, 200);
  const { data: after } = await admin.from('connect_forms').select('definition, definition_version').eq('id', form.id).single();
  assert.equal(after.definition.successMessage, 'Edited success message');
  assert.equal(after.definition_version, form.definition_version + 1);

  // Another tenant's admin cannot touch this form, nor target our tags/workflows.
  assert.equal((await api('PUT', `/api/admin/hg-link/forms/${form.id}`, { as: 'adminB', body: { ...settings, definition: edited } })).status, 404);
  const { data: tagB } = await admin.from('tags').insert({ church_id: churches.b.id, name: `B tag ${suffix}`, color: '#0f766e' }).select('id').single();
  assert.equal((await api('PUT', `/api/admin/hg-link/forms/${form.id}`, { as: 'adminA', body: { ...settings, targetTagId: tagB.id, definition: edited } })).status, 400);
});

const submitPath = () => `/api/public/connect-forms/${churches.a.slug}/serve/submit`;
const goodValues = (email) => ({
  first_name: 'Jo', last_name: 'Lee', email, phone: '012-345 6789', served_before: 'yes',
  preferred_ministry: 'worship', availability: ['sunday_mornings'], follow_up_consent: true,
});
const ip = () => ({ 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}` });

test('submission stores answers, matches the person, and is idempotent', async () => {
  const email = `jo-${suffix}@test.com`;
  const key = `serve-${suffix}`;
  const headers = { 'Idempotency-Key': key, ...ip() };
  const first = await api('POST', submitPath(), { body: { values: goodValues(email) }, headers });
  assert.equal(first.status, 200);
  assert.ok(!JSON.stringify(first.json).includes('worship'), 'public response must not echo answers');
  const replay = await api('POST', submitPath(), { body: { values: goodValues(email) }, headers });
  assert.equal(replay.json.person_id, first.json.person_id);

  const { data: rows } = await admin.from('connect_form_submissions').select('id, answers, form_version, follow_up_status').eq('church_id', churches.a.id).eq('idempotency_key', key);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].answers.preferred_ministry, 'worship');
  assert.equal(rows[0].follow_up_status, 'new');
  assert.ok(!('first_name' in rows[0].answers), 'core profile fields are not duplicated into answers');
  const { count } = await admin.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churches.a.id).eq('email', email);
  assert.equal(count, 1);

  // A second submission by the same person matches, never duplicates.
  const again = await api('POST', submitPath(), { body: { values: goodValues(email) }, headers: { 'Idempotency-Key': `again-${suffix}`, ...ip() } });
  assert.equal(again.json.person_id, first.json.person_id);
});

test('submission does not overwrite populated staff-maintained profile data', async () => {
  const email = `staff-${suffix}@test.com`;
  const { data: person } = await admin.from('people').insert({ church_id: churches.a.id, first_name: 'Sam', last_name: 'Staff', email, phone: '+60125550000', status: 'member' }).select('id').single();
  const values = { ...goodValues(email), first_name: 'Samuel', phone: '+60129990000' };
  const res = await api('POST', submitPath(), { body: { values }, headers: { 'Idempotency-Key': `ow-${suffix}`, ...ip() } });
  assert.equal(res.status, 200);
  const { data: after } = await admin.from('people').select('first_name, phone').eq('id', person.id).single();
  assert.equal(after.first_name, 'Sam');
  assert.equal(after.phone, '+60125550000');
});

test('public submission validation rejects bad answers, unknown envelopes and cross-site posts', async () => {
  const email = `bad-${suffix}@test.com`;
  const headers = () => ({ 'Idempotency-Key': crypto.randomUUID(), ...ip() });
  const badConsent = await api('POST', submitPath(), { body: { values: { ...goodValues(email), follow_up_consent: false } }, headers: headers() });
  assert.equal(badConsent.status, 400);
  assert.ok(badConsent.json.fields.follow_up_consent);
  const badOption = await api('POST', submitPath(), { body: { values: { ...goodValues(email), preferred_ministry: 'hacking' } }, headers: headers() });
  assert.equal(badOption.status, 400);
  assert.equal((await api('POST', submitPath(), { body: { first_name: 'x' }, headers: headers() })).status, 400);
  const cross = await api('POST', submitPath(), { body: { values: goodValues(email) }, headers: { ...headers(), Origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  // Church A's slug cannot reach church B's data and vice versa.
  const wrongTenant = await api('POST', `/api/public/connect-forms/${churches.b.slug}/serve/submit`, { body: { values: goodValues(email) }, headers: headers() });
  assert.equal(wrongTenant.status, 404);
});

test('submission access: role allow-list, tenant isolation, status and assignment', async () => {
  const { data: sub } = await admin.from('connect_form_submissions').select('id').eq('church_id', churches.a.id).not('person_id', 'is', null).limit(1).single();
  const url = `/api/admin/hg-link/submissions/${sub.id}`;
  for (const who of ['staffA', 'viewerA']) assert.equal((await api('PATCH', url, { as: who, body: { status: 'contacted' } })).status, 403, who);
  assert.equal((await api('PATCH', url, { as: 'adminB', body: { status: 'contacted' } })).status, 404, 'cross-tenant');
  assert.equal((await api('PATCH', url, { as: 'pastoralA', body: { status: 'contacted', assignedTo: userIds.pastoralA } })).status, 200);
  const { data: row } = await admin.from('connect_form_submissions').select('follow_up_status, assigned_to').eq('id', sub.id).single();
  assert.equal(row.follow_up_status, 'contacted');
  assert.equal(row.assigned_to, userIds.pastoralA);
  assert.equal((await api('PATCH', url, { as: 'adminA', body: { assignedTo: userIds.adminB } })).status, 400, 'assignee from another church');
  assert.equal((await api('PATCH', url, { as: 'adminA', body: { assignedTo: userIds.staffA } })).status, 400, 'assignee without access');
  assert.equal((await api('PATCH', url, { as: 'adminA', body: { status: 'bogus' } })).status, 400);
});

test('rate limiting applies to HG Link form submissions', async () => {
  const sameIp = { 'x-forwarded-for': '198.51.100.77' };
  let limited = false;
  for (let i = 0; i < 12; i += 1) {
    const res = await api('POST', submitPath(), {
      body: { values: goodValues(`rl-${i}-${suffix}@test.com`) },
      headers: { 'Idempotency-Key': crypto.randomUUID(), ...sameIp },
    });
    if (res.status === 429) { limited = true; break; }
  }
  assert.ok(limited, 'expected a 429 after exceeding the hourly limit');
  assert.ok(serveFormId);
});
