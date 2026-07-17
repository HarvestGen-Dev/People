// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

dotenv.config({ path: '.env.local', quiet: true });

const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
    realtime: { transport: ws },
  }
);

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
    realtime: { transport: ws },
  }
);

let churchA;
let churchB;
let userId;

async function insertOne(table, values, columns = 'id') {
  const { data, error } = await admin
    .from(table)
    .insert(values)
    .select(columns)
    .single();
  if (error) throw error;
  return data;
}

async function readAuditCounts() {
  const { data, error } = await admin
    .from('tenant_relationship_integrity_audit')
    .select('relationship_key, invalid_row_count');
  if (error) throw error;
  return new Map(data.map((row) => [row.relationship_key, row.invalid_row_count]));
}

function expectIncrement(beforeCounts, afterCounts, relationshipKey, increment = 1) {
  assert.equal(
    afterCounts.get(relationshipKey),
    (beforeCounts.get(relationshipKey) ?? 0) + increment,
    `${relationshipKey} should increase by ${increment}`
  );
}

before(async () => {
  churchA = await insertOne('churches', {
    slug: `tenant-fk-a-${suffix}`,
    name: `Tenant FK A ${suffix}`,
  });
  churchB = await insertOne('churches', {
    slug: `tenant-fk-b-${suffix}`,
    name: `Tenant FK B ${suffix}`,
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: `tenant-fk-${suffix}@test.com`,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
});

after(async () => {
  if (churchA?.id) await admin.from('churches').delete().eq('id', churchA.id);
  if (churchB?.id) await admin.from('churches').delete().eq('id', churchB.id);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test('tenant relationship audit views are service-role only', async () => {
  const { error } = await anon
    .from('tenant_relationship_integrity_audit')
    .select('relationship_key')
    .limit(1);

  assert.ok(error);
});

test('tenant relationship audit reports cross-tenant rows without flagging valid rows', async () => {
  const beforeCounts = await readAuditCounts();

  const [personA, personB] = await Promise.all([
    insertOne('people', {
      church_id: churchA.id,
      first_name: 'Valid',
      last_name: 'Person',
      status: 'visitor',
    }),
    insertOne('people', {
      church_id: churchB.id,
      first_name: 'Other',
      last_name: 'Person',
      status: 'visitor',
    }),
  ]);

  const [tagA, tagB] = await Promise.all([
    insertOne('tags', {
      church_id: churchA.id,
      name: `Tag A ${suffix}`,
      color: '#2563eb',
    }),
    insertOne('tags', {
      church_id: churchB.id,
      name: `Tag B ${suffix}`,
      color: '#dc2626',
    }),
  ]);

  const [fieldA, fieldB] = await Promise.all([
    insertOne('field_definitions', {
      church_id: churchA.id,
      name: `Field A ${suffix}`,
      slug: `field_a_${suffix.replaceAll('-', '_')}`,
      field_type: 'text',
    }),
    insertOne('field_definitions', {
      church_id: churchB.id,
      name: `Field B ${suffix}`,
      slug: `field_b_${suffix.replaceAll('-', '_')}`,
      field_type: 'text',
    }),
  ]);

  const [workflowA, workflowB] = await Promise.all([
    insertOne('workflows', {
      church_id: churchA.id,
      name: `Workflow A ${suffix}`,
    }),
    insertOne('workflows', {
      church_id: churchB.id,
      name: `Workflow B ${suffix}`,
    }),
  ]);

  const [stepA, stepB] = await Promise.all([
    insertOne('workflow_steps', {
      church_id: churchA.id,
      workflow_id: workflowA.id,
      name: 'Step A',
      position: 1,
    }),
    insertOne('workflow_steps', {
      church_id: churchB.id,
      workflow_id: workflowB.id,
      name: 'Step B',
      position: 1,
    }),
  ]);

  const [listA, listB] = await Promise.all([
    insertOne('lists', {
      church_id: churchA.id,
      name: `List A ${suffix}`,
      type: 'static',
    }),
    insertOne('lists', {
      church_id: churchB.id,
      name: `List B ${suffix}`,
      type: 'static',
    }),
  ]);

  const [eventA, eventB] = await Promise.all([
    insertOne('events', {
      church_id: churchA.id,
      slug: `event-a-${suffix}`,
      name: `Event A ${suffix}`,
      start_at: new Date(Date.now() + 60_000).toISOString(),
      status: 'published',
    }),
    insertOne('events', {
      church_id: churchB.id,
      slug: `event-b-${suffix}`,
      name: `Event B ${suffix}`,
      start_at: new Date(Date.now() + 120_000).toISOString(),
      status: 'published',
    }),
  ]);

  const [formA, formB] = await Promise.all([
    insertOne('connect_forms', {
      church_id: churchA.id,
      slug: `form-a-${suffix}`,
      title: 'Form A',
    }),
    insertOne('connect_forms', {
      church_id: churchB.id,
      slug: `form-b-${suffix}`,
      title: 'Form B',
    }),
  ]);

  const [webhookA, webhookB] = await Promise.all([
    insertOne('webhooks', {
      church_id: churchA.id,
      name: `Webhook A ${suffix}`,
      url: 'https://example.com/webhook-a',
      events: ['person.updated'],
      secret: 'secret-a',
    }),
    insertOne('webhooks', {
      church_id: churchB.id,
      name: `Webhook B ${suffix}`,
      url: 'https://example.com/webhook-b',
      events: ['person.updated'],
      secret: 'secret-b',
    }),
  ]);

  await Promise.all([
    admin.from('person_tags').insert({ church_id: churchA.id, person_id: personA.id, tag_id: tagA.id }),
    admin.from('notes').insert({ church_id: churchA.id, person_id: personA.id, content: 'Valid same-tenant note' }),
    admin.from('workflow_cards').insert({ church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id, current_step_id: stepA.id }),
    admin.from('list_people').insert({ church_id: churchA.id, list_id: listA.id, person_id: personA.id }),
    admin.from('event_registrations').insert({
      church_id: churchA.id,
      event_id: eventA.id,
      person_id: personA.id,
      first_name: 'Valid',
      last_name: 'Registrant',
      email: `valid-${suffix}@test.com`,
    }),
    admin.from('webhook_deliveries').insert({
      church_id: churchA.id,
      webhook_id: webhookA.id,
      event_type: 'person.updated',
      payload: { ok: true },
    }),
  ]);

  const insertions = await Promise.all([
    admin.from('person_tags').insert({ church_id: churchA.id, person_id: personB.id, tag_id: tagA.id }),
    admin.from('person_tags').insert({ church_id: churchA.id, person_id: personA.id, tag_id: tagB.id }),
    admin.from('person_field_values').insert({ church_id: churchA.id, person_id: personB.id, field_definition_id: fieldA.id, value: 'x' }),
    admin.from('person_field_values').insert({ church_id: churchA.id, person_id: personA.id, field_definition_id: fieldB.id, value: 'x' }),
    admin.from('notes').insert({ church_id: churchA.id, person_id: personB.id, content: 'Cross-tenant note' }),
    admin.from('person_events').insert({ church_id: churchA.id, person_id: personB.id, source: 'manual', event_type: 'cross_tenant_test' }),
    admin.from('workflow_cards').insert({ church_id: churchA.id, person_id: personB.id, workflow_id: workflowA.id, current_step_id: stepA.id }),
    admin.from('workflow_cards').insert({ church_id: churchA.id, person_id: personA.id, workflow_id: workflowB.id }),
    admin.from('workflow_cards').insert({ church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id, current_step_id: stepB.id }),
    admin.from('list_people').insert({ church_id: churchA.id, list_id: listB.id, person_id: personA.id }),
    admin.from('list_people').insert({ church_id: churchA.id, list_id: listA.id, person_id: personB.id }),
    admin.from('event_registrations').insert({
      church_id: churchA.id,
      event_id: eventB.id,
      person_id: personA.id,
      first_name: 'Cross',
      last_name: 'Event',
      email: `cross-event-${suffix}@test.com`,
    }),
    admin.from('event_registrations').insert({
      church_id: churchA.id,
      event_id: eventA.id,
      person_id: personB.id,
      first_name: 'Cross',
      last_name: 'Person',
      email: `cross-person-${suffix}@test.com`,
    }),
    admin.from('person_user_links').insert({
      church_id: churchA.id,
      person_id: personB.id,
      user_id: userId,
      claim_method: 'admin_approved',
    }),
    admin.from('connect_forms').insert({
      church_id: churchA.id,
      slug: `cross-form-targets-${suffix}`,
      title: 'Cross Form Targets',
      target_tag_id: tagB.id,
      target_workflow_id: workflowB.id,
    }),
    admin.from('connect_form_submissions').insert({
      church_id: churchA.id,
      form_id: formB.id,
      idempotency_key: `cross-form-${suffix}`,
    }),
    admin.from('connect_form_submissions').insert({
      church_id: churchA.id,
      form_id: formA.id,
      person_id: personB.id,
      idempotency_key: `cross-person-${suffix}`,
    }),
    admin.from('webhook_deliveries').insert({
      church_id: churchA.id,
      webhook_id: webhookB.id,
      event_type: 'person.updated',
      payload: { ok: false },
    }),
  ]);

  const insertionErrors = insertions.map((result) => result.error).filter(Boolean);
  assert.deepEqual(insertionErrors, []);

  const afterCounts = await readAuditCounts();
  for (const relationshipKey of [
    'person_tags.person_id->people.id',
    'person_tags.tag_id->tags.id',
    'person_field_values.person_id->people.id',
    'person_field_values.field_definition_id->field_definitions.id',
    'notes.person_id->people.id',
    'person_events.person_id->people.id',
    'workflow_cards.person_id->people.id',
    'workflow_cards.workflow_id->workflows.id',
    'workflow_cards.current_step_id->workflow_steps.id',
    'list_people.list_id->lists.id',
    'list_people.person_id->people.id',
    'event_registrations.event_id->events.id',
    'event_registrations.person_id->people.id',
    'person_user_links.person_id->people.id',
    'connect_forms.target_tag_id->tags.id',
    'connect_forms.target_workflow_id->workflows.id',
    'connect_form_submissions.form_id->connect_forms.id',
    'connect_form_submissions.person_id->people.id',
    'webhook_deliveries.webhook_id->webhooks.id',
  ]) {
    expectIncrement(beforeCounts, afterCounts, relationshipKey);
  }

  const { data: detailRows, error: detailError } = await admin
    .from('tenant_relationship_integrity_violations')
    .select('relationship_key, child_identifier, child_church_id, parent_church_id')
    .eq('child_church_id', churchA.id)
    .eq('parent_church_id', churchB.id);
  if (detailError) throw detailError;
  assert.equal(detailRows.length >= 19, true);
});
