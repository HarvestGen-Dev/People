// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import {
  startNextDevServer,
  waitForNextDevServer,
} from './next-test-server.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.WEBHOOK_WORKER_TEST_PORT ?? 3113);
const baseUrl = `http://127.0.0.1:${port}`;
const workerSecret = `worker-${crypto.randomBytes(8).toString('hex')}`;
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
let receiver;
let receiverPort;
let churchId;
let adminCookies = '';
let viewerCookies = '';
const userIds = [];
const received = [];
let deliverySequence = 0;

function expectedSignature(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

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

async function insertDelivery(path) {
  const secret = `secret-${crypto.randomBytes(4).toString('hex')}`;
  const { data: webhook, error: webhookError } = await admin
    .from('webhooks')
    .insert({
      church_id: churchId,
      name: `Webhook ${path} ${suffix}`,
      url: `http://127.0.0.1:${receiverPort}${path}`,
      events: ['person.created'],
      secret,
      is_active: true,
    })
    .select('id, secret')
    .single();
  if (webhookError) throw webhookError;

  const eventId = crypto.randomUUID();
  const deliveryId = crypto.randomUUID();
  const payload = {
    event: 'person.created',
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data: { id: crypto.randomUUID() },
  };

  const { data: delivery, error: deliveryError } = await admin
    .from('webhook_deliveries')
    .insert({
      church_id: churchId,
      webhook_id: webhook.id,
      event_id: eventId,
      delivery_id: deliveryId,
      event_type: 'person.created',
      payload,
      status: 'pending',
      attempt_count: 0,
      created_at: new Date(Date.UTC(2000, 0, 1, 0, 0, deliverySequence++)).toISOString(),
    })
    .select('id, event_id, delivery_id')
    .single();
  if (deliveryError) throw deliveryError;
  return { webhook, delivery, payload };
}

async function runWorker(body = { batch_size: 10 }, authorization = `Bearer ${workerSecret}`) {
  const response = await fetch(`${baseUrl}/api/cron/webhook-deliveries`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { response, body: json };
}

before(async () => {
  receiver = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      received.push({ url: req.url, headers: req.headers, body });
      if (req.url === '/ok') {
        res.writeHead(204);
        res.end();
      } else if (req.url === '/bad') {
        res.writeHead(400);
        res.end('bad request details');
      } else if (req.url === '/rate-limit') {
        res.writeHead(429);
        res.end('slow down');
      } else {
        res.writeHead(500);
        res.end('unknown');
      }
    });
  });
  receiver.listen(0, '127.0.0.1');
  await Promise.race([
    once(receiver, 'listening'),
    once(receiver, 'error').then(([error]) => {
      throw error;
    }),
  ]);
  receiverPort = receiver.address().port;

  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({ slug: `webhook-worker-${suffix}`, name: `Webhook Worker ${suffix}` })
    .select('id')
    .single();
  if (churchError) throw churchError;
  churchId = church.id;

  for (const role of ['admin', 'viewer']) {
    const email = `${role}-webhook-${suffix}@test.com`;
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

  server = startNextDevServer({
    port,
    env: {
      WEBHOOK_WORKER_SECRET: workerSecret,
      ALLOW_LOCAL_WEBHOOKS: 'true',
    },
  });
  await waitForNextDevServer({ server, baseUrl });
});

after(async () => {
  if (churchId) await admin.from('churches').delete().eq('id', churchId);
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  if (server?.process && !server.process.killed) server.process.kill('SIGTERM');
  if (receiver) receiver.close();
});

test('worker requires POST and a valid configured secret', async () => {
  const getRes = await fetch(`${baseUrl}/api/cron/webhook-deliveries`);
  assert.equal(getRes.status, 405);

  const invalid = await runWorker({ batch_size: 1 }, 'Bearer wrong');
  assert.equal(invalid.response.status, 401);
});

test('worker delivers successful requests with stable IDs and valid signature', async () => {
  const { webhook, delivery, payload } = await insertDelivery('/ok');
  const result = await runWorker({ batch_size: 1 });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.delivered, 1);

  const { data: updated } = await admin
    .from('webhook_deliveries')
    .select('status, attempt_count, delivered_at')
    .eq('id', delivery.id)
    .single();
  assert.equal(updated.status, 'delivered');
  assert.equal(updated.attempt_count, 1);
  assert.ok(updated.delivered_at);

  const request = received.find((item) => item.url === '/ok');
  assert.ok(request);
  assert.equal(request.headers['x-people-event-id'], delivery.event_id);
  assert.equal(request.headers['x-people-delivery-id'], delivery.delivery_id);
  assert.equal(JSON.parse(request.body).event_id, payload.event_id);
  assert.equal(
    request.headers['x-people-signature'],
    `sha256=${expectedSignature(webhook.secret, request.headers['x-people-timestamp'], request.body)}`
  );
});

test('worker classifies 400 as permanent and 429 as retryable', async () => {
  const bad = await insertDelivery('/bad');
  const rateLimited = await insertDelivery('/rate-limit');
  const result = await runWorker({ batch_size: 2 });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.permanently_failed, 1);
  assert.equal(result.body.data.retry_scheduled, 1);

  const { data: badDelivery } = await admin
    .from('webhook_deliveries')
    .select('status, next_attempt_at, response_excerpt')
    .eq('id', bad.delivery.id)
    .single();
  assert.equal(badDelivery.status, 'permanently_failed');
  assert.equal(badDelivery.next_attempt_at, null);
  assert.match(badDelivery.response_excerpt, /bad request/);

  const { data: retryDelivery } = await admin
    .from('webhook_deliveries')
    .select('status, next_attempt_at')
    .eq('id', rateLimited.delivery.id)
    .single();
  assert.equal(retryDelivery.status, 'retry_scheduled');
  assert.ok(retryDelivery.next_attempt_at);
});

test('manual retry is owner/admin-only and preserves event identity', async () => {
  const { data: failed } = await admin
    .from('webhook_deliveries')
    .select('id, event_id, delivery_id')
    .eq('church_id', churchId)
    .eq('status', 'permanently_failed')
    .limit(1)
    .single();

  const viewer = await fetch(`${baseUrl}/api/admin/webhook-deliveries/${failed.id}/retry`, {
    method: 'POST',
    headers: { Cookie: viewerCookies },
  });
  assert.equal(viewer.status, 403);

  const adminRetry = await fetch(`${baseUrl}/api/admin/webhook-deliveries/${failed.id}/retry`, {
    method: 'POST',
    headers: { Cookie: adminCookies },
  });
  assert.equal(adminRetry.status, 200);

  const { data: retried } = await admin
    .from('webhook_deliveries')
    .select('status, event_id, delivery_id')
    .eq('id', failed.id)
    .single();
  assert.equal(retried.status, 'pending');
  assert.equal(retried.event_id, failed.event_id);
  assert.notEqual(retried.delivery_id, failed.delivery_id);
});
