// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

dotenv.config({ path: '.env.local', quiet: true });

const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const fixedNow = new Date('2026-07-20T12:00:00.000Z');
const password = 'Password123!';
const churchIds = [];
const userIds = [];

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch },
  realtime: { transport: ws },
};
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientOptions
);

async function insertOne(table, values, columns = '*') {
  const { data, error } = await admin.from(table).insert(values).select(columns).single();
  if (error) throw error;
  return data;
}

async function createChurch(label) {
  const church = await insertOne('churches', {
    name: `${label} ${suffix}`,
    slug: `${label.toLowerCase()}-${suffix}`,
  });
  churchIds.push(church.id);
  return church;
}

async function createSignedInClient(churchId, role, label) {
  const email = `${label}-${suffix}@test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userIds.push(data.user.id);
  if (role) {
    await insertOne('church_memberships', {
      church_id: churchId,
      user_id: data.user.id,
      role,
    });
  }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    clientOptions
  );
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function summary(name, churchId) {
  const { data, error } = await admin.rpc(name, {
    p_church_id: churchId,
    p_now: fixedNow.toISOString(),
  });
  if (error) throw error;
  return data;
}

async function seedPulseConfig(churchId) {
  const workflow = await insertOne('workflows', {
    church_id: churchId,
    name: `Operations workflow ${suffix}`,
  });
  await insertOne('workflow_steps', {
    church_id: churchId,
    workflow_id: workflow.id,
    name: 'Review',
    position: 1,
  });
  return insertOne('workflow_pulse_configs', {
    church_id: churchId,
    workflow_id: workflow.id,
    days_inactive: 30,
    target_person_status: 'active',
    is_active: true,
  });
}

before(async () => {
  assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/);
});

after(async () => {
  if (churchIds.length) {
    const { error } = await admin.from('churches').delete().in('id', churchIds);
    if (error) throw error;
  }
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test('healthy summaries are empty, tenant-scoped, and service-role-only', async () => {
  const churchA = await createChurch('Operational A');
  const churchB = await createChurch('Operational B');
  const owner = await createSignedInClient(churchA.id, 'owner', 'operations-owner');
  const staff = await createSignedInClient(churchA.id, 'staff', 'operations-staff');
  const portal = await createSignedInClient(churchA.id, null, 'operations-portal');
  const anonymous = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    clientOptions
  );

  for (const name of [
    'get_operational_registration_health',
    'get_operational_email_health',
    'get_operational_webhook_health',
    'get_operational_pulse_health',
  ]) {
    const data = await summary(name, churchA.id);
    assert.equal(typeof data, 'object');
    for (const client of [owner, staff, portal, anonymous]) {
      const { error } = await client.rpc(name, {
        p_church_id: churchB.id,
        p_now: fixedNow.toISOString(),
      });
      assert.ok(error, `${name} must not be executable outside service_role`);
    }
  }

  const { error: directReadError } = await owner.from('operational_incidents').select('*');
  assert.ok(directReadError, 'authenticated owners must use the protected server page');
  const registration = await summary('get_operational_registration_health', churchA.id);
  assert.equal(registration.pending_review_count, 0);
  assert.equal(registration.technical_failures_7d, 0);
});

test('registration and email summaries distinguish normal queues, leases, and technical failures', async () => {
  const churchA = await createChurch('Registration Health A');
  const churchB = await createChurch('Registration Health B');
  const eventA = await insertOne('events', {
    church_id: churchA.id,
    slug: `ops-event-a-${suffix}`,
    name: `Operations event A ${suffix}`,
    start_at: new Date(fixedNow.getTime() + 86_400_000).toISOString(),
    status: 'published',
    price: 10,
  });
  const eventB = await insertOne('events', {
    church_id: churchB.id,
    slug: `ops-event-b-${suffix}`,
    name: `Operations event B ${suffix}`,
    start_at: new Date(fixedNow.getTime() + 86_400_000).toISOString(),
    status: 'published',
  });
  const baseRegistration = {
    first_name: 'Synthetic',
    last_name: 'Registrant',
    email: `registrant-${suffix}@test.invalid`,
    guests: 0,
  };
  const pending = await insertOne('event_registrations', {
    ...baseRegistration,
    church_id: churchA.id,
    event_id: eventA.id,
    status: 'pending_review',
    created_at: new Date(fixedNow.getTime() - 2 * 3_600_000).toISOString(),
  });
  await insertOne('event_registrations', {
    ...baseRegistration,
    email: `active-claim-${suffix}@test.invalid`,
    church_id: churchA.id,
    event_id: eventA.id,
    status: 'approved',
    confirmation_email_claimed_at: new Date(fixedNow.getTime() - 299_000).toISOString(),
  });
  await insertOne('event_registrations', {
    ...baseRegistration,
    email: `stuck-claim-${suffix}@test.invalid`,
    church_id: churchA.id,
    event_id: eventA.id,
    status: 'approved',
    confirmation_email_claimed_at: new Date(fixedNow.getTime() - 301_000).toISOString(),
  });
  await insertOne('event_registrations', {
    ...baseRegistration,
    email: `other-tenant-${suffix}@test.invalid`,
    church_id: churchB.id,
    event_id: eventB.id,
    status: 'pending_review',
  });
  await admin.from('operational_incidents').insert([
    {
      church_id: churchA.id,
      event_name: 'registration.approval.failed',
      severity: 'error',
      resource_type: 'event_registration',
      resource_id: pending.id,
      error_code: 'synthetic_approval_failure',
      retryable: false,
      occurred_at: new Date(fixedNow.getTime() - 60_000).toISOString(),
    },
    {
      church_id: churchA.id,
      event_name: 'email.send.failed',
      severity: 'error',
      resource_type: 'event_registration',
      resource_id: pending.id,
      error_code: 'synthetic_smtp_failure',
      retryable: true,
      occurred_at: new Date(fixedNow.getTime() - 60_000).toISOString(),
    },
    {
      church_id: churchB.id,
      event_name: 'registration.submit.failed',
      severity: 'error',
      resource_type: 'event',
      resource_id: eventB.id,
      error_code: 'other_tenant_failure',
      retryable: false,
      occurred_at: new Date(fixedNow.getTime() - 60_000).toISOString(),
    },
  ]).then(({ error }) => { if (error) throw error; });

  const registrations = await summary('get_operational_registration_health', churchA.id);
  assert.equal(registrations.pending_review_count, 1);
  assert.equal(registrations.payment_review_count, 1);
  assert.equal(registrations.approval_failures_24h, 1);
  assert.equal(registrations.submission_failures_24h, 0);

  const email = await summary('get_operational_email_health', churchA.id);
  assert.equal(email.lease_seconds, 300);
  assert.equal(email.active_claim_count, 1);
  assert.equal(email.stuck_claim_count, 1);
  assert.equal(email.retryable_failure_count, 1);
  assert.equal(email.smtp_failures_24h, 1);
  assert.ok(email.oldest_stuck_claim_at);
});

test('webhook summaries report retry, terminal, abandoned, and superseded states without payloads', async () => {
  const church = await createChurch('Webhook Health');
  const webhook = await insertOne('webhooks', {
    church_id: church.id,
    name: `Synthetic webhook ${suffix}`,
    url: 'https://example.test/webhook',
    events: ['person.created'],
    secret: 'not-a-real-secret',
  });
  const sharedEventId = crypto.randomUUID();
  const hourAgo = new Date(fixedNow.getTime() - 3_600_000).toISOString();
  const halfHourAgo = new Date(fixedNow.getTime() - 1_800_000).toISOString();
  const deliveries = [
    {
      church_id: church.id, webhook_id: webhook.id, event_type: 'person.created', payload: { private: 'not returned' },
      status: 'retry_scheduled', attempt_count: 2, failed_at: hourAgo, next_attempt_at: halfHourAgo,
    },
    {
      church_id: church.id, webhook_id: webhook.id, event_type: 'person.created', payload: { private: 'not returned' },
      status: 'permanently_failed', attempt_count: 7, failed_at: hourAgo,
    },
    {
      church_id: church.id, webhook_id: webhook.id, event_type: 'person.created', payload: { private: 'not returned' },
      status: 'processing', attempt_count: 1, processing_lease_until: new Date(fixedNow.getTime() - 1_000).toISOString(),
    },
    {
      church_id: church.id, webhook_id: webhook.id, event_type: 'person.created', event_id: sharedEventId,
      payload: { private: 'not returned' }, status: 'permanently_failed', attempt_count: 7, failed_at: hourAgo,
    },
    {
      church_id: church.id, webhook_id: webhook.id, event_type: 'person.created', event_id: sharedEventId,
      payload: { private: 'not returned' }, status: 'delivered', attempt_count: 1,
      delivered_at: new Date(fixedNow.getTime() - 30_000).toISOString(),
    },
  ].map((delivery) => ({
    event_id: crypto.randomUUID(),
    delivery_id: crypto.randomUUID(),
    ...delivery,
  }));
  const { error } = await admin.from('webhook_deliveries').insert(deliveries);
  if (error) throw error;

  const health = await summary('get_operational_webhook_health', church.id);
  assert.equal(health.lease_seconds, 60);
  assert.equal(health.pending_due_count, 1);
  assert.equal(health.retry_scheduled_count, 1);
  assert.equal(health.permanently_failed_count, 1, 'later success supersedes the same event failure');
  assert.equal(health.abandoned_processing_count, 1);
  assert.ok(health.last_success_at);
  assert.doesNotMatch(JSON.stringify(health), /private|payload|secret|response_excerpt/);
});

test('pulse summaries expose scoped failures, repeated skips, and abandoned runs', async () => {
  const church = await createChurch('Pulse Health');
  const config = await seedPulseConfig(church.id);
  const runs = [
    { run_id: crypto.randomUUID(), status: 'completed', started_at: new Date(fixedNow.getTime() - 4 * 3_600_000), finished_at: new Date(fixedNow.getTime() - 4 * 3_600_000 + 1_000) },
    { run_id: crypto.randomUUID(), status: 'completed_with_errors', started_at: new Date(fixedNow.getTime() - 3 * 3_600_000), finished_at: new Date(fixedNow.getTime() - 3 * 3_600_000 + 1_000) },
    { run_id: crypto.randomUUID(), status: 'skipped_locked', started_at: new Date(fixedNow.getTime() - 2 * 3_600_000), finished_at: new Date(fixedNow.getTime() - 2 * 3_600_000 + 1_000) },
    { run_id: crypto.randomUUID(), status: 'skipped_locked', started_at: new Date(fixedNow.getTime() - 90 * 60_000), finished_at: new Date(fixedNow.getTime() - 90 * 60_000 + 1_000) },
    { run_id: crypto.randomUUID(), status: 'skipped_locked', started_at: new Date(fixedNow.getTime() - 60 * 60_000), finished_at: new Date(fixedNow.getTime() - 60 * 60_000 + 1_000) },
    { run_id: crypto.randomUUID(), scope_church_id: church.id, status: 'running', started_at: new Date(fixedNow.getTime() - 31 * 60_000), finished_at: null },
  ];
  for (const run of runs) {
    await insertOne('missing_persons_pulse_runs', {
      ...run,
      started_at: run.started_at.toISOString(),
      finished_at: run.finished_at?.toISOString() ?? null,
    });
  }
  const configRows = [
    { run_id: runs[0].run_id, status: 'completed', cards_created: 4 },
    { run_id: runs[1].run_id, status: 'failed', sanitized_error_code: 'synthetic_config_failure' },
    { run_id: runs[2].run_id, status: 'skipped_locked' },
    { run_id: runs[3].run_id, status: 'skipped_locked' },
    { run_id: runs[4].run_id, status: 'skipped_locked' },
  ];
  for (const [index, row] of configRows.entries()) {
    await insertOne('missing_persons_pulse_run_configs', {
      church_id: church.id,
      pulse_config_id: config.id,
      started_at: runs[index].started_at.toISOString(),
      finished_at: runs[index].finished_at.toISOString(),
      ...row,
    });
  }

  const health = await summary('get_operational_pulse_health', church.id);
  assert.equal(health.abandoned_after_seconds, 1800);
  assert.equal(health.lock_skips_24h, 3);
  assert.equal(health.latest_run_failed_configs, 0);
  assert.equal(health.latest_success_cards_created, 4);
  assert.equal(health.abandoned_running_count, 1);
  assert.ok(health.last_partial_at);

  const recoveryRun = {
    run_id: crypto.randomUUID(),
    status: 'completed',
    started_at: new Date(fixedNow.getTime() - 30 * 60_000),
    finished_at: new Date(fixedNow.getTime() - 30 * 60_000 + 1_000),
  };
  await insertOne('missing_persons_pulse_runs', {
    ...recoveryRun,
    started_at: recoveryRun.started_at.toISOString(),
    finished_at: recoveryRun.finished_at.toISOString(),
  });
  await insertOne('missing_persons_pulse_run_configs', {
    run_id: recoveryRun.run_id,
    church_id: church.id,
    pulse_config_id: config.id,
    status: 'completed',
    started_at: recoveryRun.started_at.toISOString(),
    finished_at: recoveryRun.finished_at.toISOString(),
  });
  const recovered = await summary('get_operational_pulse_health', church.id);
  assert.equal(recovered.lock_skips_24h, 0, 'later success supersedes earlier lock skips');
  assert.ok(new Date(recovered.last_success_at) > new Date(recovered.last_failure_at));
});

test('structured logger bounds metadata, redacts secrets, and cannot crash its caller', async () => {
  const source = await readFile(new URL('../../src/lib/observability/logger.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const logger = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  assert.equal(logger.OPERATIONAL_EVENTS.emailSendFailed, 'email.send.failed');
  assert.equal(logger.OPERATIONAL_EVENTS.missingPersonsRunAbandoned, 'missing_persons.run.abandoned');

  const circular = {};
  circular.self = circular;
  const metadata = logger.sanitizeOperationalMetadata({
    authorization: 'Bearer should-never-appear',
    api_key: 'secret-value',
    safe: 'x'.repeat(400),
    circular,
  });
  assert.equal(metadata.authorization, '[redacted]');
  assert.equal(metadata.api_key, '[redacted]');
  assert.equal(metadata.safe.length, 256);
  assert.equal(metadata.circular, '[unsupported]');

  const normalized = logger.normalizeOperationalError(new Error(`failure ${'x'.repeat(400)}`));
  assert.equal(normalized.errorMessage.length, 256);
  assert.doesNotThrow(() => logger.logOperationalEvent({
    event: logger.OPERATIONAL_EVENTS.webhookWorkerFailed,
    severity: 'error',
    metadata: new Proxy({}, { ownKeys() { throw new Error('logger trap'); } }),
  }));
});
