// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.LOOKUP_TEST_PORT ?? 3107);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const rawApiKey = `people_k1_${crypto.randomBytes(16).toString('hex')}`;

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

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for the Next.js test server');
}

async function lookup(payload) {
  const response = await fetch(`${baseUrl}/api/v1/people/lookup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rawApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { response, body };
}

async function insertPerson(values) {
  const { data, error } = await admin
    .from('people')
    .insert({
      church_id: churchId,
      first_name: 'Fixture',
      last_name: suffix,
      status: 'visitor',
      ...values,
    })
    .select('id, display_id')
    .single();
  if (error) throw error;
  return data;
}

before(async () => {
  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({
      slug: `lookup-test-${suffix}`,
      name: `Lookup Test ${suffix}`,
    })
    .select('id')
    .single();
  if (churchError) throw churchError;
  churchId = church.id;

  const keyHash = crypto
    .createHash('sha256')
    .update(rawApiKey)
    .digest('hex');
  const { error: keyError } = await admin.from('api_keys').insert({
    church_id: churchId,
    name: `Lookup Test ${suffix}`,
    key_hash: keyHash,
    key_prefix: rawApiKey.slice(0, 18),
    scopes: ['people:lookup'],
  });
  if (keyError) throw keyError;

  server = spawn(
    './node_modules/.bin/next',
    [
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      `${port}`,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  await waitForServer();
});

after(async () => {
  if (churchId) {
    await admin.from('churches').delete().eq('id', churchId);
  }
  if (server && !server.killed) {
    server.kill('SIGTERM');
  }
});

test('creates a normalized visitor when no identity matches', async () => {
  const { response, body } = await lookup({
    first_name: 'New',
    last_name: 'Visitor',
    email: `  NEW.VISITOR.${suffix}@EXAMPLE.COM `,
    phone: '012-345 6789',
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.found, false);
  assert.equal(body.data.person.status, 'visitor');
  assert.match(body.data.person.id, /^PER-[0-9A-F]{10}$/);
  assert.equal(body.data.person.email, `new.visitor.${suffix}@example.com`);
  assert.equal(body.data.person.phone, '+60123456789');
});

test('matches repeated email case-insensitively', async () => {
  const email = `repeat.${suffix}@example.com`;
  const first = await lookup({
    first_name: 'First',
    last_name: 'Email',
    email,
  });
  const second = await lookup({
    first_name: 'Second',
    last_name: 'Email',
    email: `  ${email.toUpperCase()}  `,
  });

  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(first.body.data.found, false);
  assert.equal(second.body.data.found, true);
  assert.equal(second.body.data.person.id, first.body.data.person.id);
});

test('matches a phone-only lookup across Malaysian formatting', async () => {
  const person = await insertPerson({ phone: '+60 17-222 3344' });
  const { response, body } = await lookup({ phone: '0172223344' });

  assert.equal(response.status, 200);
  assert.equal(body.data.found, true);
  assert.equal(body.data.person.id, person.display_id);
});

test('returns conflict when a phone matches multiple people', async () => {
  await insertPerson({ phone: '016-888 9911' });
  await insertPerson({ phone: '+60 16 888 9911' });

  const { response, body } = await lookup({ phone: '0168889911' });

  assert.equal(response.status, 409);
  assert.equal(body.code, 'identity_conflict');
  assert.match(body.error, /Multiple people match this phone number/);
});

test('returns conflict when email and phone match different people', async () => {
  const email = `conflict-a.${suffix}@example.com`;
  await insertPerson({ email, phone: '0181112233' });
  await insertPerson({
    email: `conflict-b.${suffix}@example.com`,
    phone: '0194445566',
  });

  const { response, body } = await lookup({
    email,
    phone: '0194445566',
  });

  assert.equal(response.status, 409);
  assert.equal(body.code, 'identity_conflict');
  assert.match(body.error, /Email and phone match different people/);
});

test('serializes concurrent lookups into one person', async () => {
  const email = `concurrent.${suffix}@example.com`;
  const phone = '011-7700 8800';
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      lookup({
        first_name: 'Concurrent',
        last_name: 'Visitor',
        email,
        phone,
      })
    )
  );

  assert.ok(results.every(({ response }) => response.status === 200));
  assert.equal(
    results.filter(({ body }) => body.data.found === false).length,
    1
  );
  assert.equal(
    new Set(results.map(({ body }) => body.data.person.id)).size,
    1
  );

  const { count, error } = await admin
    .from('people')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', churchId)
    .eq('email_normalized', email);
  if (error) throw error;
  assert.equal(count, 1);
});
