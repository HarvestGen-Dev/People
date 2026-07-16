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

const port = Number(process.env.CONNECT_FORM_TEST_PORT ?? 3112);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';

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
let otherChurchId;
let form;
let tagId;
let workflowId;
let adminCookies = '';
let viewerCookies = '';
const userIds = [];

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

async function submit(payload, key = crypto.randomUUID()) {
  const response = await fetch(`${baseUrl}/api/public/connect-forms/${form.slug}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { response, body };
}

before(async () => {
  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({ slug: `connect-${suffix}`, name: `Connect ${suffix}` })
    .select('id')
    .single();
  if (churchError) throw churchError;
  churchId = church.id;

  const { data: otherChurch, error: otherChurchError } = await admin
    .from('churches')
    .insert({ slug: `connect-other-${suffix}`, name: `Connect Other ${suffix}` })
    .select('id')
    .single();
  if (otherChurchError) throw otherChurchError;
  otherChurchId = otherChurch.id;

  const { data: tag, error: tagError } = await admin
    .from('tags')
    .insert({ church_id: churchId, name: `Connect Tag ${suffix}`, color: '#0f766e' })
    .select('id')
    .single();
  if (tagError) throw tagError;
  tagId = tag.id;

  const { data: workflow, error: workflowError } = await admin
    .from('workflows')
    .insert({ church_id: churchId, name: `Connect Workflow ${suffix}`, is_active: true })
    .select('id')
    .single();
  if (workflowError) throw workflowError;
  workflowId = workflow.id;

  const { error: stepError } = await admin
    .from('workflow_steps')
    .insert({ church_id: churchId, workflow_id: workflowId, name: 'New', position: 1, default_days_to_complete: 3 });
  if (stepError) throw stepError;

  const { data: connectForm, error: formError } = await admin
    .from('connect_forms')
    .insert({
      church_id: churchId,
      slug: `connect-form-${suffix}`,
      title: 'Connect',
      target_tag_id: tagId,
      target_workflow_id: workflowId,
      is_active: true,
    })
    .select('id, slug')
    .single();
  if (formError) throw formError;
  form = connectForm;

  for (const role of ['admin', 'viewer']) {
    const email = `${role}-connect-${suffix}@test.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const { error: membershipError } = await admin
      .from('church_memberships')
      .insert({ church_id: churchId, user_id: data.user.id, role });
    if (membershipError) throw membershipError;
    const cookie = await sessionCookie(email);
    if (role === 'admin') adminCookies = cookie;
    if (role === 'viewer') viewerCookies = cookie;
  }

  server = startNextDevServer({ port });
  await waitForNextDevServer({ server, baseUrl });
});

after(async () => {
  if (churchId) await admin.from('churches').delete().eq('id', churchId);
  if (otherChurchId) await admin.from('churches').delete().eq('id', otherChurchId);
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  if (server?.process && !server.process.killed) server.process.kill('SIGTERM');
});

test('new connect-form submission creates one person with idempotent tag, workflow, and event side effects', async () => {
  const key = `new-${suffix}`;
  const payload = {
    first_name: 'Connect',
    last_name: 'New',
    email: `connect-new-${suffix}@test.com`,
    phone: '012-300 4000',
    gender: 'female',
    birthdate: '1990-01-02',
    campus: 'Bandar Sunway',
  };

  const first = await submit(payload, key);
  const retry = await submit(payload, key);

  assert.equal(first.response.status, 200);
  assert.equal(retry.response.status, 200);
  assert.equal(retry.body.person_id, first.body.person_id);

  const [{ count: peopleCount }, { count: tagCount }, { count: cardCount }, { count: eventCount }] = await Promise.all([
    admin.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('email', payload.email),
    admin.from('person_tags').select('person_id', { count: 'exact', head: true }).eq('church_id', churchId).eq('person_id', first.body.person_id).eq('tag_id', tagId),
    admin.from('workflow_cards').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('person_id', first.body.person_id).eq('workflow_id', workflowId),
    admin.from('person_events').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('person_id', first.body.person_id).eq('event_type', 'connect_form_submitted'),
  ]);

  assert.equal(peopleCount, 1);
  assert.equal(tagCount, 1);
  assert.equal(cardCount, 1);
  assert.equal(eventCount, 1);
});

test('existing person conflicting values create proposals without overwriting staff values', async () => {
  const { data: person, error } = await admin
    .from('people')
    .insert({
      church_id: churchId,
      first_name: 'Existing',
      last_name: 'Person',
      email: `existing-${suffix}@test.com`,
      phone: '+60129990000',
      campus: 'Verified Campus',
      status: 'visitor',
    })
    .select('id')
    .single();
  if (error) throw error;

  const result = await submit({
    first_name: 'Existing',
    last_name: 'Changed',
    email: `existing-${suffix}@test.com`,
    phone: '+60129990000',
    campus: 'Submitted Campus',
  }, `conflict-${suffix}`);

  assert.equal(result.response.status, 200);
  assert.equal(result.body.person_id, person.id);
  assert.equal(result.body.found, true);

  const { data: updated } = await admin
    .from('people')
    .select('last_name, campus')
    .eq('id', person.id)
    .single();
  assert.equal(updated.last_name, 'Person');
  assert.equal(updated.campus, 'Verified Campus');

  const { data: proposals } = await admin
    .from('person_proposed_updates')
    .select('field_name, proposed_value, status')
    .eq('church_id', churchId)
    .eq('person_id', person.id)
    .eq('status', 'pending');

  assert.ok(proposals.some((proposal) => proposal.field_name === 'last_name' && proposal.proposed_value === 'Changed'));
  assert.ok(proposals.some((proposal) => proposal.field_name === 'campus' && proposal.proposed_value === 'Submitted Campus'));
});

test('email and phone identifying different people returns conflict and rolls back side effects', async () => {
  await admin.from('people').insert([
    { church_id: churchId, first_name: 'Email', last_name: 'Owner', email: `email-owner-${suffix}@test.com`, phone: '+60121110000', status: 'visitor' },
    { church_id: churchId, first_name: 'Phone', last_name: 'Owner', email: `phone-owner-${suffix}@test.com`, phone: '+60122220000', status: 'visitor' },
  ]);

  const result = await submit({
    first_name: 'Conflict',
    last_name: 'Case',
    email: `email-owner-${suffix}@test.com`,
    phone: '+60122220000',
  }, `identity-conflict-${suffix}`);

  assert.equal(result.response.status, 409);

  const { count } = await admin
    .from('person_events')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', churchId)
    .contains('metadata', { idempotency_key: `identity-conflict-${suffix}` });
  assert.equal(count, 0);
});

test('proposal access is manager-only and acceptance applies the reviewed field', async () => {
  const { data: proposal } = await admin
    .from('person_proposed_updates')
    .select('id, person_id')
    .eq('church_id', churchId)
    .eq('field_name', 'campus')
    .eq('status', 'pending')
    .limit(1)
    .single();

  const viewerRes = await fetch(`${baseUrl}/api/admin/proposed-updates`, {
    headers: { Cookie: viewerCookies },
  });
  assert.equal(viewerRes.status, 403);

  const acceptRes = await fetch(`${baseUrl}/api/admin/proposed-updates/${proposal.id}`, {
    method: 'PATCH',
    headers: {
      Cookie: adminCookies,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision: 'accepted', resolution_note: 'Verified' }),
  });
  assert.equal(acceptRes.status, 200);

  const { data: person } = await admin
    .from('people')
    .select('campus')
    .eq('id', proposal.person_id)
    .single();
  assert.equal(person.campus, 'Submitted Campus');
});
