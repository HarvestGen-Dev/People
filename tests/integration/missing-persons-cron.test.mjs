// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  startNextDevServer,
  waitForNextDevServer,
} from './next-test-server.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.MISSING_PERSONS_CRON_TEST_PORT ?? 3115);
const baseUrl = `http://127.0.0.1:${port}`;
const cronSecret = `pulse-${crypto.randomBytes(16).toString('hex')}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const fixedNow = new Date('2026-06-15T12:00:00.000Z');
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
    realtime: { transport: ws },
  }
);

let server;
let sequence = 0;
const churchIds = [];
const userIds = [];

async function insertOne(table, values, columns = '*') {
  const { data, error } = await admin.from(table).insert(values).select(columns).single();
  if (error) throw error;
  return data;
}

async function stopServer(instance) {
  if (!instance?.process || instance.process.killed) return;
  instance.process.kill('SIGTERM');
  await Promise.race([
    once(instance.process, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

async function createScenario({
  status = 'active',
  daysInactive = 30,
  withStep = true,
  churchId,
  name = 'Pulse',
} = {}) {
  let church = churchId ? { id: churchId } : null;
  if (!church) {
    church = await insertOne('churches', {
      slug: `pulse-${suffix}-${sequence++}`,
      name: `${name} Church ${suffix}`,
    });
    churchIds.push(church.id);
  }

  const workflow = await insertOne('workflows', {
    church_id: church.id,
    name: `${name} Workflow ${sequence++}`,
  });
  const step = withStep
    ? await insertOne('workflow_steps', {
        church_id: church.id,
        workflow_id: workflow.id,
        name: 'First follow-up',
        position: 1,
        default_days_to_complete: 4,
      })
    : null;
  const config = await insertOne('workflow_pulse_configs', {
    church_id: church.id,
    workflow_id: workflow.id,
    days_inactive: daysInactive,
    target_person_status: status,
    is_active: true,
  });

  return { church, workflow, step, config };
}

async function createPerson(churchId, status = 'active', label = 'Person') {
  return insertOne('people', {
    church_id: churchId,
    first_name: label,
    last_name: `${suffix}-${sequence++}`,
    status,
  });
}

async function runPulse({ churchId = null, now = fixedNow, runId = crypto.randomUUID() } = {}) {
  const { data, error } = await admin.rpc('run_missing_persons_pulse', {
    p_run_id: runId,
    p_church_id: churchId,
    p_now: now.toISOString(),
  });
  if (error) throw error;
  return data;
}

async function requestPulse(authorization, runId) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (runId) headers['x-cron-run-id'] = runId;
  const response = await fetch(`${baseUrl}/api/cron/missing-persons-pulse`, {
    method: 'POST',
    headers,
  });
  return { response, body: await response.json() };
}

async function holdConfigLock(configId, seconds = 2) {
  const process = spawn('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-At'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stderr = '';
  process.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for advisory lock')), 5_000);
    process.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('LOCK_ACQUIRED')) {
        clearTimeout(timeout);
        process.stdin.write(`SELECT pg_sleep(${seconds}); COMMIT;\\q\n`);
        resolve();
      }
    });
    process.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Lock process failed (${code}): ${stderr}`));
      }
    });
    process.stdin.write(
      [
        'BEGIN;',
        `SELECT pg_advisory_xact_lock(hashtextextended('missing-persons-pulse:${configId}', 0));`,
        "SELECT 'LOCK_ACQUIRED';",
      ].join('\n') + '\n'
    );
  });

  return process;
}

async function executeSql(sql) {
  const process = spawn('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', sql], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  process.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(process, 'exit');
  if (code !== 0) throw new Error(`psql failed (${code}): ${stderr}`);
}

async function executeFailingSql(sql) {
  const process = spawn('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', sql], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [code] = await once(process, 'exit');
  assert.notEqual(code, 0, 'The test transaction should fail');
}

after(async () => {
  await stopServer(server);
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  if (churchIds.length > 0) {
    const ids = churchIds.map((id) => `'${id}'::uuid`).join(', ');
    await executeSql([
      'BEGIN;',
      'ALTER TABLE public.person_events DISABLE TRIGGER person_events_append_only;',
      `DELETE FROM public.churches WHERE id IN (${ids});`,
      'ALTER TABLE public.person_events ENABLE TRIGGER person_events_append_only;',
      'COMMIT;',
    ].join(' '));
  }
});

test('cron authentication fails closed, rejects GET and bad secrets, and accepts the configured secret', async () => {
  const unconfigured = startNextDevServer({ port, env: { CRON_SECRET: '' } });
  await waitForNextDevServer({ server: unconfigured, baseUrl });

  const unavailable = await fetch(`${baseUrl}/api/cron/missing-persons-pulse`, {
    method: 'POST',
  });
  const unavailableBody = await unavailable.json();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailableBody.error.code, 'cron_not_configured');
  await stopServer(unconfigured);

  server = startNextDevServer({ port, env: { CRON_SECRET: cronSecret } });
  await waitForNextDevServer({ server, baseUrl });

  const getResponse = await fetch(`${baseUrl}/api/cron/missing-persons-pulse`);
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get('allow'), 'POST');

  const missing = await requestPulse();
  const incorrect = await requestPulse('Bearer incorrect');
  assert.equal(missing.response.status, 401);
  assert.equal(incorrect.response.status, 401);

  const runId = crypto.randomUUID();
  const accepted = await requestPulse(`Bearer ${cronSecret}`, runId);
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.run_id, runId);
  assert.ok(['completed', 'completed_with_errors'].includes(accepted.body.status));
  assert.doesNotMatch(JSON.stringify(accepted.body), new RegExp(cronSecret));

  const emptyChurch = await insertOne('churches', {
    slug: `pulse-empty-${suffix}`,
    name: `Empty Pulse Church ${suffix}`,
  });
  churchIds.push(emptyChurch.id);
  const empty = await runPulse({ churchId: emptyChurch.id });
  assert.equal(empty.status, 'completed');
  assert.equal(empty.configs_processed, 0);
  assert.equal(empty.cards_created, 0);
});

test('eligibility uses exact status, elapsed UTC time, an inclusive activity boundary, and any event type', async () => {
  const scenario = await createScenario();
  const noHistory = await createPerson(scenario.church.id, 'active', 'NoHistory');
  const oldActivity = await createPerson(scenario.church.id, 'active', 'OldActivity');
  const recentActivity = await createPerson(scenario.church.id, 'active', 'RecentActivity');
  const boundaryActivity = await createPerson(scenario.church.id, 'active', 'BoundaryActivity');
  await createPerson(scenario.church.id, 'visitor', 'Visitor');
  await createPerson(scenario.church.id, 'inactive', 'Inactive');
  await createPerson(scenario.church.id, 'child', 'Child');

  const { error: eventError } = await admin.from('person_events').insert([
    {
      church_id: scenario.church.id,
      person_id: oldActivity.id,
      source: 'manual',
      event_type: 'arbitrary_activity',
      occurred_at: new Date(fixedNow.getTime() - 31 * 86_400_000).toISOString(),
    },
    {
      church_id: scenario.church.id,
      person_id: recentActivity.id,
      source: 'people',
      event_type: 'non_attendance_custom_event',
      occurred_at: new Date(fixedNow.getTime() - 29 * 86_400_000).toISOString(),
    },
    {
      church_id: scenario.church.id,
      person_id: boundaryActivity.id,
      source: 'shepherd',
      event_type: 'last_active',
      occurred_at: new Date(fixedNow.getTime() - 30 * 86_400_000).toISOString(),
    },
  ]);
  if (eventError) throw eventError;

  const runId = crypto.randomUUID();
  const result = await runPulse({ churchId: scenario.church.id, runId });
  assert.deepEqual(
    {
      status: result.status,
      scanned: result.people_scanned,
      matched: result.people_matched,
      created: result.cards_created,
    },
    { status: 'completed', scanned: 4, matched: 2, created: 2 }
  );

  const { data: cards, error } = await admin
    .from('workflow_cards')
    .select('person_id, source, pulse_config_id, pulse_run_id, triggered_at, due_date')
    .eq('church_id', scenario.church.id)
    .order('person_id');
  if (error) throw error;
  assert.deepEqual(
    cards.map((card) => card.person_id).sort(),
    [noHistory.id, oldActivity.id].sort()
  );
  for (const card of cards) {
    assert.equal(card.source, 'missing_persons_pulse');
    assert.equal(card.pulse_config_id, scenario.config.id);
    assert.equal(card.pulse_run_id, runId);
    assert.equal(new Date(card.triggered_at).toISOString(), fixedNow.toISOString());
    assert.equal(card.due_date, '2026-06-19');
  }

  const repeated = await runPulse({ churchId: scenario.church.id });
  assert.equal(repeated.cards_created, 0);
  assert.equal(repeated.cards_skipped, 2);

  const replayed = await runPulse({ churchId: scenario.church.id, runId });
  assert.deepEqual(replayed, result);
});

test('completed pulse cards allow re-entry while active manual cards suppress it', async () => {
  const scenario = await createScenario({ name: 'Lifecycle' });
  const person = await createPerson(scenario.church.id);

  const first = await runPulse({ churchId: scenario.church.id });
  assert.equal(first.cards_created, 1);
  const completedAt = new Date(fixedNow.getTime() + 60_000).toISOString();
  const { error: completeError } = await admin
    .from('workflow_cards')
    .update({ completed_at: completedAt })
    .eq('church_id', scenario.church.id)
    .eq('person_id', person.id);
  if (completeError) throw completeError;

  const reentry = await runPulse({
    churchId: scenario.church.id,
    now: new Date(fixedNow.getTime() + 120_000),
  });
  assert.equal(reentry.cards_created, 1);

  const { error: secondCompleteError } = await admin
    .from('workflow_cards')
    .update({ completed_at: new Date(fixedNow.getTime() + 180_000).toISOString() })
    .eq('church_id', scenario.church.id)
    .is('completed_at', null);
  if (secondCompleteError) throw secondCompleteError;
  await insertOne('workflow_cards', {
    church_id: scenario.church.id,
    person_id: person.id,
    workflow_id: scenario.workflow.id,
    current_step_id: scenario.step.id,
    notes: 'Manual follow-up remains active.',
  });

  const manualSuppression = await runPulse({
    churchId: scenario.church.id,
    now: new Date(fixedNow.getTime() + 240_000),
  });
  assert.equal(manualSuppression.cards_created, 0);
  assert.equal(manualSuppression.cards_skipped, 1);
});

test('separate pulse configurations create independent cards for the same person', async () => {
  const first = await createScenario({ name: 'Independent A' });
  const second = await createScenario({ churchId: first.church.id, name: 'Independent B' });
  const person = await createPerson(first.church.id);

  const result = await runPulse({ churchId: first.church.id });
  assert.equal(result.configs_processed, 2);
  assert.equal(result.cards_created, 2);

  const { data: cards, error } = await admin
    .from('workflow_cards')
    .select('workflow_id, pulse_config_id')
    .eq('church_id', first.church.id)
    .eq('person_id', person.id);
  if (error) throw error;
  assert.equal(new Set(cards.map((card) => card.workflow_id)).size, 2);
  assert.deepEqual(
    new Set(cards.map((card) => card.pulse_config_id)),
    new Set([first.config.id, second.config.id])
  );
});

test('run ID retries return the existing result and reject conflicting tenant scope reuse', async () => {
  const first = await createScenario({ name: 'Run ID A' });
  const second = await createScenario({ name: 'Run ID B' });
  await createPerson(first.church.id);
  await createPerson(second.church.id);
  const runId = crypto.randomUUID();

  const original = await runPulse({ churchId: first.church.id, runId });
  const retry = await runPulse({ churchId: first.church.id, runId });
  const conflict = await runPulse({ churchId: second.church.id, runId });

  assert.deepEqual(retry, original);
  assert.equal(conflict.status, 'failed');
  assert.equal(conflict.error_code, 'run_id_scope_conflict');
  assert.equal(conflict.cards_created, 0);

  const { count, error } = await admin
    .from('workflow_cards')
    .select('*', { count: 'exact', head: true })
    .eq('church_id', second.church.id);
  if (error) throw error;
  assert.equal(count, 0);
});

test('a missing workflow step is a scoped failure and does not roll back another configuration', async () => {
  const valid = await createScenario({ name: 'Valid Scope' });
  const invalid = await createScenario({
    churchId: valid.church.id,
    name: 'Invalid Scope',
    withStep: false,
  });
  await createPerson(valid.church.id);

  const runId = crypto.randomUUID();
  const result = await runPulse({ churchId: valid.church.id, runId });
  assert.equal(result.status, 'completed_with_errors');
  assert.equal(result.configs_processed, 1);
  assert.equal(result.configs_failed, 1);
  assert.equal(result.cards_created, 1);

  const { data: failedScope, error } = await admin
    .from('missing_persons_pulse_run_configs')
    .select('status, sanitized_error_code, sanitized_error_message, metadata')
    .eq('run_id', runId)
    .eq('pulse_config_id', invalid.config.id)
    .single();
  if (error) throw error;
  assert.equal(failedScope.status, 'failed');
  assert.equal(failedScope.sanitized_error_code, 'missing_workflow_step');
  assert.doesNotMatch(JSON.stringify(failedScope), /first_name|last_name|email|phone|constraint/i);

  const { error: metadataError } = await admin
    .from('missing_persons_pulse_run_configs')
    .update({ metadata: { value: 'x'.repeat(9_000) } })
    .eq('run_id', runId)
    .eq('pulse_config_id', invalid.config.id);
  assert.equal(metadataError?.code, '23514');

  const { data: activeConfigs, error: activeConfigError } = await admin
    .from('workflow_pulse_configs')
    .select('id')
    .eq('is_active', true);
  if (activeConfigError) throw activeConfigError;
  const { error: deactivateError } = await admin
    .from('workflow_pulse_configs')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (deactivateError) throw deactivateError;
  const { error: activateInvalidError } = await admin
    .from('workflow_pulse_configs')
    .update({ is_active: true })
    .eq('id', invalid.config.id);
  if (activateInvalidError) throw activateInvalidError;

  const failedRoute = await requestPulse(`Bearer ${cronSecret}`);
  assert.equal(failedRoute.response.status, 500);
  assert.equal(failedRoute.body.status, 'failed');
  assert.equal(failedRoute.body.error_code, 'all_configurations_failed');
  assert.doesNotMatch(
    JSON.stringify(failedRoute.body),
    /constraint|sqlstate|stack|first_name|last_name|email|phone/i
  );

  if (activeConfigs.length > 0) {
    const { error: restoreError } = await admin
      .from('workflow_pulse_configs')
      .update({ is_active: true })
      .in('id', activeConfigs.map((config) => config.id));
    if (restoreError) throw restoreError;
  }
});

test('concurrent invocations create at most one active pulse card', async () => {
  const scenario = await createScenario({ name: 'Concurrency' });
  const person = await createPerson(scenario.church.id);

  const results = await Promise.all([
    runPulse({ churchId: scenario.church.id }),
    runPulse({ churchId: scenario.church.id }),
  ]);
  assert.equal(results.reduce((sum, result) => sum + result.cards_created, 0), 1);

  const { count, error } = await admin
    .from('workflow_cards')
    .select('*', { count: 'exact', head: true })
    .eq('church_id', scenario.church.id)
    .eq('person_id', person.id)
    .is('completed_at', null);
  if (error) throw error;
  assert.equal(count, 1);
});

test('lock contention is deterministic and transaction-scoped locks release automatically', async () => {
  const scenario = await createScenario({ name: 'Locking' });
  await createPerson(scenario.church.id);
  const lockProcess = await holdConfigLock(scenario.config.id);

  const skippedRunId = crypto.randomUUID();
  const skipped = await runPulse({ churchId: scenario.church.id, runId: skippedRunId });
  assert.equal(skipped.status, 'skipped_locked');
  assert.equal(skipped.reason, 'already_running');
  assert.equal(skipped.configs_skipped, 1);
  await once(lockProcess, 'exit');

  const afterRelease = await runPulse({ churchId: scenario.church.id });
  assert.equal(afterRelease.status, 'completed');
  assert.equal(afterRelease.cards_created, 1);

  const { error: lockCompleteError } = await admin
    .from('workflow_cards')
    .update({ completed_at: new Date(fixedNow.getTime() + 60_000).toISOString() })
    .eq('church_id', scenario.church.id)
    .is('completed_at', null);
  if (lockCompleteError) throw lockCompleteError;
  await executeFailingSql([
    'BEGIN;',
    `SELECT pg_advisory_xact_lock(hashtextextended('missing-persons-pulse:${scenario.config.id}', 0));`,
    'SELECT 1 / 0;',
    'COMMIT;',
  ].join(' '));
  const afterFailedTransaction = await runPulse({
    churchId: scenario.church.id,
    now: new Date(fixedNow.getTime() + 120_000),
  });
  assert.equal(afterFailedTransaction.cards_created, 1);

  const { data: skippedHistory, error } = await admin
    .from('missing_persons_pulse_runs')
    .select('status, finished_at, sanitized_error_code')
    .eq('run_id', skippedRunId)
    .single();
  if (error) throw error;
  assert.equal(skippedHistory.status, 'skipped_locked');
  assert.ok(skippedHistory.finished_at);
});

test('tenant composite foreign keys reject cross-tenant configs, steps, people, and cards', async () => {
  const tenantA = await createScenario({ name: 'Tenant A' });
  const tenantB = await createScenario({ name: 'Tenant B' });
  const personA = await createPerson(tenantA.church.id);
  const personB = await createPerson(tenantB.church.id);

  const { error: configError } = await admin.from('workflow_pulse_configs').insert({
    church_id: tenantA.church.id,
    workflow_id: tenantB.workflow.id,
    days_inactive: 30,
    target_person_status: 'active',
  });
  assert.equal(configError?.code, '23503');

  const { error: thresholdError } = await admin
    .from('workflow_pulse_configs')
    .update({ days_inactive: 0 })
    .eq('id', tenantA.config.id);
  assert.equal(thresholdError?.code, '23514');

  const { error: stepError } = await admin.from('workflow_steps').insert({
    church_id: tenantA.church.id,
    workflow_id: tenantB.workflow.id,
    name: 'Cross-tenant step',
    position: 2,
  });
  assert.equal(stepError?.code, '23503');

  const { error: cardPersonError } = await admin.from('workflow_cards').insert({
    church_id: tenantA.church.id,
    workflow_id: tenantA.workflow.id,
    current_step_id: tenantA.step.id,
    person_id: personB.id,
  });
  assert.equal(cardPersonError?.code, '23503');

  const { error: cardStepError } = await admin.from('workflow_cards').insert({
    church_id: tenantA.church.id,
    workflow_id: tenantA.workflow.id,
    current_step_id: tenantB.step.id,
    person_id: personA.id,
  });
  assert.equal(cardStepError?.code, '23503');

  const result = await runPulse({ churchId: tenantA.church.id });
  assert.equal(result.people_scanned, 1);
  const { count, error: countError } = await admin
    .from('workflow_cards')
    .select('*', { count: 'exact', head: true })
    .eq('church_id', tenantA.church.id)
    .eq('person_id', personB.id);
  if (countError) throw countError;
  assert.equal(count, 0);

  const { error: provenanceError } = await admin.from('workflow_cards').insert({
    church_id: tenantA.church.id,
    workflow_id: tenantA.workflow.id,
    current_step_id: tenantA.step.id,
    person_id: personA.id,
    source: 'missing_persons_pulse',
    pulse_config_id: tenantB.config.id,
    pulse_run_id: result.run_id,
    triggered_at: fixedNow.toISOString(),
  });
  assert.equal(provenanceError?.code, '23503');
});

test('run history is service-writable, tenant-admin readable, and hidden from ordinary users', async () => {
  const scenario = await createScenario({ name: 'History Access' });
  await createPerson(scenario.church.id);
  const runId = crypto.randomUUID();
  await runPulse({ churchId: scenario.church.id, runId });

  const password = 'Password123!';
  const clients = {};
  for (const role of ['admin', 'viewer']) {
    const email = `${role}-pulse-${suffix}@test.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    await insertOne('church_memberships', {
      church_id: scenario.church.id,
      user_id: data.user.id,
      role,
    });
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch },
        realtime: { transport: ws },
      }
    );
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    clients[role] = client;
  }

  const { data: adminScopes, error: adminScopeError } = await clients.admin
    .from('missing_persons_pulse_run_configs')
    .select('run_id, church_id, status')
    .eq('run_id', runId);
  if (adminScopeError) throw adminScopeError;
  assert.equal(adminScopes.length, 1);

  const { data: viewerScopes, error: viewerScopeError } = await clients.viewer
    .from('missing_persons_pulse_run_configs')
    .select('run_id')
    .eq('run_id', runId);
  if (viewerScopeError) throw viewerScopeError;
  assert.equal(viewerScopes.length, 0);

  const { error: aggregateError } = await clients.admin
    .from('missing_persons_pulse_runs')
    .select('run_id')
    .eq('run_id', runId);
  assert.ok(aggregateError);

  const { error: rpcError } = await clients.admin.rpc('run_missing_persons_pulse', {
    p_run_id: crypto.randomUUID(),
  });
  assert.ok(rpcError);
});

test('500 eligible people are handled by one set-based RPC and repeated execution stays idempotent', async () => {
  const scenario = await createScenario({ name: 'Performance' });
  const people = Array.from({ length: 500 }, (_, index) => ({
    church_id: scenario.church.id,
    first_name: 'Load',
    last_name: `${suffix}-${index}`,
    status: 'active',
  }));
  const { error: peopleError } = await admin.from('people').insert(people);
  if (peopleError) throw peopleError;

  const startedAt = performance.now();
  const first = await runPulse({ churchId: scenario.church.id });
  const durationMs = performance.now() - startedAt;
  assert.equal(first.people_scanned, 500);
  assert.equal(first.people_matched, 500);
  assert.equal(first.cards_created, 500);
  assert.ok(durationMs < 15_000, `Expected bounded execution, received ${durationMs}ms`);

  const repeated = await runPulse({ churchId: scenario.church.id });
  assert.equal(repeated.cards_created, 0);
  assert.equal(repeated.cards_skipped, 500);

  const routeSource = await readFile(
    'src/app/api/cron/missing-persons-pulse/route.ts',
    'utf8'
  );
  assert.equal((routeSource.match(/\.rpc\(/g) ?? []).length, 1);
  assert.equal((routeSource.match(/\.from\(/g) ?? []).length, 0);

  const { data: duplicateAudit, error: auditError } = await admin
    .from('missing_persons_pulse_active_duplicate_audit')
    .select('church_id')
    .eq('church_id', scenario.church.id);
  if (auditError) throw auditError;
  assert.equal(duplicateAudit.length, 0);
});
