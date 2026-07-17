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

let churchA;
let churchB;
let userId;
let secondUserId;
let fixture;

async function insertOne(table, values, columns = '*') {
  const { data, error } = await admin
    .from(table)
    .insert(values)
    .select(columns)
    .single();
  if (error) throw error;
  return data;
}

async function expectInsertRejected(table, values, label) {
  const { error } = await admin.from(table).insert(values);
  assert.ok(error, `${label} should be rejected`);
  assert.equal(error.code, '23503', `${label} should fail at FK constraint level`);
}

async function expectUpdateRejected(table, filters, values, label) {
  let query = admin.from(table).update(values);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { error } = await query;
  assert.ok(error, `${label} should be rejected`);
  assert.equal(error.code, '23503', `${label} should fail at FK constraint level`);
}

async function assertNoRows(table, filters, label) {
  let query = admin.from(table).select('*', { count: 'exact', head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw error;
  assert.equal(count, 0, label);
}

before(async () => {
  churchA = await insertOne('churches', {
    slug: `tenant-enforce-a-${suffix}`,
    name: `Tenant Enforce A ${suffix}`,
  });
  churchB = await insertOne('churches', {
    slug: `tenant-enforce-b-${suffix}`,
    name: `Tenant Enforce B ${suffix}`,
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: `tenant-enforce-${suffix}@test.com`,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
  const { data: secondUser, error: secondUserError } = await admin.auth.admin.createUser({
    email: `tenant-enforce-second-${suffix}@test.com`,
    password,
    email_confirm: true,
  });
  if (secondUserError) throw secondUserError;
  secondUserId = secondUser.user.id;

  const [householdA, householdB] = await Promise.all([
    insertOne('households', { church_id: churchA.id, name: `Household A ${suffix}` }),
    insertOne('households', { church_id: churchB.id, name: `Household B ${suffix}` }),
  ]);
  const [personA, personB] = await Promise.all([
    insertOne('people', {
      church_id: churchA.id,
      household_id: householdA.id,
      first_name: 'Tenant',
      last_name: 'Person A',
      status: 'visitor',
    }),
    insertOne('people', {
      church_id: churchB.id,
      household_id: householdB.id,
      first_name: 'Tenant',
      last_name: 'Person B',
      status: 'visitor',
    }),
  ]);
  const [tagA, tagB] = await Promise.all([
    insertOne('tags', { church_id: churchA.id, name: `Tag A ${suffix}`, color: '#2563eb' }),
    insertOne('tags', { church_id: churchB.id, name: `Tag B ${suffix}`, color: '#dc2626' }),
  ]);
  const [fieldA, fieldB] = await Promise.all([
    insertOne('field_definitions', {
      church_id: churchA.id,
      name: `Field A ${suffix}`,
      slug: `enforce_field_a_${suffix.replaceAll('-', '_')}`,
      field_type: 'text',
    }),
    insertOne('field_definitions', {
      church_id: churchB.id,
      name: `Field B ${suffix}`,
      slug: `enforce_field_b_${suffix.replaceAll('-', '_')}`,
      field_type: 'text',
    }),
  ]);
  const [roleA, roleB] = await Promise.all([
    insertOne('roles', { church_id: churchA.id, name: `Role A ${suffix}` }),
    insertOne('roles', { church_id: churchB.id, name: `Role B ${suffix}` }),
  ]);
  const [workflowA, workflowB] = await Promise.all([
    insertOne('workflows', { church_id: churchA.id, name: `Workflow A ${suffix}` }),
    insertOne('workflows', { church_id: churchB.id, name: `Workflow B ${suffix}` }),
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
    insertOne('lists', { church_id: churchA.id, name: `List A ${suffix}`, type: 'static' }),
    insertOne('lists', { church_id: churchB.id, name: `List B ${suffix}`, type: 'static' }),
  ]);
  const [eventA, eventB] = await Promise.all([
    insertOne('events', {
      church_id: churchA.id,
      slug: `event-a-${suffix}`,
      name: `Event A ${suffix}`,
      target_workflow_id: workflowA.id,
      start_at: new Date(Date.now() + 60_000).toISOString(),
      status: 'published',
    }),
    insertOne('events', {
      church_id: churchB.id,
      slug: `event-b-${suffix}`,
      name: `Event B ${suffix}`,
      target_workflow_id: workflowB.id,
      start_at: new Date(Date.now() + 120_000).toISOString(),
      status: 'published',
    }),
  ]);
  const [formA, formB] = await Promise.all([
    insertOne('connect_forms', {
      church_id: churchA.id,
      slug: `form-a-${suffix}`,
      title: 'Form A',
      target_tag_id: tagA.id,
      target_workflow_id: workflowA.id,
    }),
    insertOne('connect_forms', {
      church_id: churchB.id,
      slug: `form-b-${suffix}`,
      title: 'Form B',
      target_tag_id: tagB.id,
      target_workflow_id: workflowB.id,
    }),
  ]);
  const [webhookA, webhookB] = await Promise.all([
    insertOne('webhooks', {
      church_id: churchA.id,
      name: `Webhook A ${suffix}`,
      url: 'https://example.com/a',
      events: ['person.updated'],
      secret: 'secret-a',
    }),
    insertOne('webhooks', {
      church_id: churchB.id,
      name: `Webhook B ${suffix}`,
      url: 'https://example.com/b',
      events: ['person.updated'],
      secret: 'secret-b',
    }),
  ]);

  fixture = {
    householdA,
    householdB,
    personA,
    personB,
    tagA,
    tagB,
    fieldA,
    fieldB,
    roleA,
    roleB,
    workflowA,
    workflowB,
    stepA,
    stepB,
    listA,
    listB,
    eventA,
    eventB,
    formA,
    formB,
    webhookA,
    webhookB,
  };
});

after(async () => {
  if (churchA?.id) await admin.from('churches').delete().eq('id', churchA.id);
  if (churchB?.id) await admin.from('churches').delete().eq('id', churchB.id);
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (secondUserId) await admin.auth.admin.deleteUser(secondUserId);
});

test('valid same-tenant relationships still insert successfully', async () => {
  const {
    personA,
    tagA,
    fieldA,
    roleA,
    workflowA,
    stepA,
    listA,
    eventA,
    formA,
    webhookA,
  } = fixture;

  const validRows = await Promise.all([
    admin.from('person_tags').insert({ church_id: churchA.id, person_id: personA.id, tag_id: tagA.id }),
    admin.from('person_field_values').insert({ church_id: churchA.id, person_id: personA.id, field_definition_id: fieldA.id, value: 'same tenant' }),
    admin.from('notes').insert({ church_id: churchA.id, person_id: personA.id, content: 'Same-tenant note' }),
    admin.from('person_events').insert({ church_id: churchA.id, person_id: personA.id, source: 'manual', event_type: 'same_tenant' }),
    admin.from('person_roles').insert({ church_id: churchA.id, person_id: personA.id, role_id: roleA.id }),
    admin.from('workflow_pulse_configs').insert({ church_id: churchA.id, workflow_id: workflowA.id }),
    admin.from('workflow_cards').insert({ church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id, current_step_id: stepA.id }),
    admin.from('list_people').insert({ church_id: churchA.id, list_id: listA.id, person_id: personA.id }),
    admin.from('event_registrations').insert({
      church_id: churchA.id,
      event_id: eventA.id,
      person_id: personA.id,
      first_name: 'Same',
      last_name: 'Tenant',
      email: `same-tenant-${suffix}@test.com`,
    }),
    admin.from('person_user_links').insert({ church_id: churchA.id, person_id: personA.id, user_id: userId, claim_method: 'admin_approved' }),
    admin.from('connect_form_submissions').insert({ church_id: churchA.id, form_id: formA.id, person_id: personA.id, idempotency_key: `same-tenant-${suffix}` }),
    admin.from('webhook_deliveries').insert({ church_id: churchA.id, webhook_id: webhookA.id, event_type: 'person.updated', payload: { ok: true } }),
  ]);

  assert.deepEqual(validRows.map((result) => result.error).filter(Boolean), []);
});

test('service-role cross-tenant inserts fail at composite FK constraints', async () => {
  const {
    householdB,
    personA,
    personB,
    tagA,
    tagB,
    fieldA,
    fieldB,
    roleA,
    roleB,
    workflowA,
    workflowB,
    stepA,
    stepB,
    listA,
    listB,
    eventA,
    eventB,
    formA,
    formB,
    webhookB,
  } = fixture;

  await expectInsertRejected('people', {
    church_id: churchA.id,
    household_id: householdB.id,
    first_name: 'Cross',
    last_name: 'Household',
    status: 'visitor',
  }, 'Church A person with Church B household');
  await assertNoRows('people', { church_id: churchA.id, first_name: 'Cross', last_name: 'Household' }, 'cross-tenant household insert should not persist');

  await expectInsertRejected('person_tags', { church_id: churchA.id, person_id: personB.id, tag_id: tagA.id }, 'Church A tag assignment with Church B person');
  await expectInsertRejected('person_tags', { church_id: churchA.id, person_id: personA.id, tag_id: tagB.id }, 'Church A tag assignment with Church B tag');
  await expectInsertRejected('person_field_values', { church_id: churchA.id, person_id: personB.id, field_definition_id: fieldA.id, value: 'x' }, 'Church A field value with Church B person');
  await expectInsertRejected('person_field_values', { church_id: churchA.id, person_id: personA.id, field_definition_id: fieldB.id, value: 'x' }, 'Church A field value with Church B field');
  await expectInsertRejected('notes', { church_id: churchA.id, person_id: personB.id, content: 'Cross tenant' }, 'Church A note with Church B person');
  await expectInsertRejected('person_events', { church_id: churchA.id, person_id: personB.id, source: 'manual', event_type: 'cross_tenant' }, 'Church A event with Church B person');
  await expectInsertRejected('person_roles', { church_id: churchA.id, person_id: personB.id, role_id: roleA.id }, 'Church A role assignment with Church B person');
  await expectInsertRejected('person_roles', { church_id: churchA.id, person_id: personA.id, role_id: roleB.id }, 'Church A role assignment with Church B role');
  await expectInsertRejected('workflow_steps', { church_id: churchA.id, workflow_id: workflowB.id, name: 'Cross Step', position: 9 }, 'Church A step with Church B workflow');
  await expectInsertRejected('workflow_pulse_configs', { church_id: churchA.id, workflow_id: workflowB.id }, 'Church A pulse config with Church B workflow');
  await expectInsertRejected('tags', { church_id: churchA.id, name: `Cross Tag ${suffix}`, color: '#111827', target_workflow_id: workflowB.id }, 'Church A tag with Church B target workflow');
  await expectInsertRejected('events', {
    church_id: churchA.id,
    slug: `cross-event-workflow-${suffix}`,
    name: 'Cross Event Workflow',
    start_at: new Date(Date.now() + 180_000).toISOString(),
    target_workflow_id: workflowB.id,
  }, 'Church A event with Church B target workflow');
  await expectInsertRejected('workflow_cards', { church_id: churchA.id, person_id: personB.id, workflow_id: workflowA.id, current_step_id: stepA.id }, 'Church A workflow card with Church B person');
  await expectInsertRejected('workflow_cards', { church_id: churchA.id, person_id: personA.id, workflow_id: workflowB.id }, 'Church A workflow card with Church B workflow');
  await expectInsertRejected('workflow_cards', { church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id, current_step_id: stepB.id }, 'Church A workflow card with Church B step');
  await expectInsertRejected('list_people', { church_id: churchA.id, list_id: listB.id, person_id: personA.id }, 'Church A list membership with Church B list');
  await expectInsertRejected('list_people', { church_id: churchA.id, list_id: listA.id, person_id: personB.id }, 'Church A list membership with Church B person');
  await expectInsertRejected('event_registrations', {
    church_id: churchA.id,
    event_id: eventB.id,
    person_id: personA.id,
    first_name: 'Cross',
    last_name: 'Event',
    email: `cross-event-${suffix}@test.com`,
  }, 'Church A registration with Church B event');
  await expectInsertRejected('event_registrations', {
    church_id: churchA.id,
    event_id: eventA.id,
    person_id: personB.id,
    first_name: 'Cross',
    last_name: 'Person',
    email: `cross-person-${suffix}@test.com`,
  }, 'Church A registration with Church B person');
  await expectInsertRejected('person_user_links', { church_id: churchA.id, person_id: personB.id, user_id: secondUserId, claim_method: 'admin_approved' }, 'Church A portal link with Church B person');
  await expectInsertRejected('connect_forms', {
    church_id: churchA.id,
    slug: `cross-form-${suffix}`,
    title: 'Cross Form',
    target_tag_id: tagB.id,
  }, 'Church A form with Church B tag');
  await expectInsertRejected('connect_forms', {
    church_id: churchA.id,
    slug: `cross-form-workflow-${suffix}`,
    title: 'Cross Form Workflow',
    target_workflow_id: workflowB.id,
  }, 'Church A form with Church B workflow');
  await expectInsertRejected('connect_form_submissions', { church_id: churchA.id, form_id: formB.id, idempotency_key: `cross-form-${suffix}` }, 'Church A submission with Church B form');
  await expectInsertRejected('connect_form_submissions', { church_id: churchA.id, form_id: formA.id, person_id: personB.id, idempotency_key: `cross-person-${suffix}` }, 'Church A submission with Church B person');
  await expectInsertRejected('webhook_deliveries', { church_id: churchA.id, webhook_id: webhookB.id, event_type: 'person.updated', payload: { ok: false } }, 'Church A delivery with Church B webhook');
});

test('valid rows cannot be updated into cross-tenant relationships', async () => {
  const {
    householdB,
    personA,
    personB,
    tagA,
    tagB,
    fieldA,
    fieldB,
    roleA,
    roleB,
    workflowA,
    workflowB,
    stepB,
    listA,
    listB,
    eventA,
    eventB,
    formA,
    formB,
    webhookA,
    webhookB,
  } = fixture;

  await expectUpdateRejected('people', { id: personA.id }, { household_id: householdB.id }, 'updating person to Church B household');
  await expectUpdateRejected('person_tags', { church_id: churchA.id, person_id: personA.id, tag_id: tagA.id }, { tag_id: tagB.id }, 'updating tag assignment to Church B tag');
  await expectUpdateRejected('person_field_values', { church_id: churchA.id, person_id: personA.id, field_definition_id: fieldA.id }, { field_definition_id: fieldB.id }, 'updating field value to Church B field');
  await expectUpdateRejected('notes', { church_id: churchA.id, person_id: personA.id }, { person_id: personB.id }, 'updating note to Church B person');
  await expectUpdateRejected('person_roles', { church_id: churchA.id, person_id: personA.id, role_id: roleA.id }, { role_id: roleB.id }, 'updating person role to Church B role');
  await expectUpdateRejected('workflow_steps', { church_id: churchA.id, workflow_id: workflowA.id }, { workflow_id: workflowB.id }, 'updating step to Church B workflow');
  await expectUpdateRejected('workflow_pulse_configs', { church_id: churchA.id, workflow_id: workflowA.id }, { workflow_id: workflowB.id }, 'updating pulse config to Church B workflow');
  await expectUpdateRejected('tags', { id: tagA.id }, { target_workflow_id: workflowB.id }, 'updating tag target workflow to Church B workflow');
  await expectUpdateRejected('events', { id: eventA.id }, { target_workflow_id: workflowB.id }, 'updating event target workflow to Church B workflow');
  await expectUpdateRejected('workflow_cards', { church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id }, { person_id: personB.id }, 'updating workflow card to Church B person');
  await expectUpdateRejected('workflow_cards', { church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id }, { workflow_id: workflowB.id }, 'updating workflow card to Church B workflow');
  await expectUpdateRejected('workflow_cards', { church_id: churchA.id, person_id: personA.id, workflow_id: workflowA.id }, { current_step_id: stepB.id }, 'updating workflow card to Church B step');
  await expectUpdateRejected('list_people', { church_id: churchA.id, list_id: listA.id, person_id: personA.id }, { list_id: listB.id }, 'updating list membership to Church B list');
  await expectUpdateRejected('list_people', { church_id: churchA.id, list_id: listA.id, person_id: personA.id }, { person_id: personB.id }, 'updating list membership to Church B person');
  await expectUpdateRejected('event_registrations', { church_id: churchA.id, event_id: eventA.id, person_id: personA.id }, { event_id: eventB.id }, 'updating registration to Church B event');
  await expectUpdateRejected('event_registrations', { church_id: churchA.id, event_id: eventA.id, person_id: personA.id }, { person_id: personB.id }, 'updating registration to Church B person');
  await expectUpdateRejected('person_user_links', { church_id: churchA.id, person_id: personA.id }, { person_id: personB.id }, 'updating portal link to Church B person');
  await expectUpdateRejected('connect_forms', { id: formA.id }, { target_tag_id: tagB.id }, 'updating form target tag to Church B tag');
  await expectUpdateRejected('connect_forms', { id: formA.id }, { target_workflow_id: workflowB.id }, 'updating form target workflow to Church B workflow');
  await expectUpdateRejected('connect_form_submissions', { church_id: churchA.id, form_id: formA.id, person_id: personA.id }, { form_id: formB.id }, 'updating submission to Church B form');
  await expectUpdateRejected('connect_form_submissions', { church_id: churchA.id, form_id: formA.id, person_id: personA.id }, { person_id: personB.id }, 'updating submission to Church B person');
  await expectUpdateRejected('webhook_deliveries', { church_id: churchA.id, webhook_id: webhookA.id }, { webhook_id: webhookB.id }, 'updating delivery to Church B webhook');
});

test('representative delete actions preserve existing semantics', async () => {
  const household = await insertOne('households', { church_id: churchA.id, name: `Delete Household ${suffix}` });
  const person = await insertOne('people', {
    church_id: churchA.id,
    household_id: household.id,
    first_name: 'Delete',
    last_name: 'Semantics',
    status: 'visitor',
  });
  const { error: householdDeleteError } = await admin.from('households').delete().eq('id', household.id);
  assert.equal(householdDeleteError, null);
  const { data: personAfterHouseholdDelete } = await admin
    .from('people')
    .select('household_id')
    .eq('id', person.id)
    .single();
  assert.equal(personAfterHouseholdDelete.household_id, null);

  const tag = await insertOne('tags', { church_id: churchA.id, name: `Delete Tag ${suffix}`, color: '#111827' });
  await admin.from('person_tags').insert({ church_id: churchA.id, person_id: person.id, tag_id: tag.id });
  await admin.from('tags').delete().eq('id', tag.id);
  await assertNoRows('person_tags', { church_id: churchA.id, person_id: person.id, tag_id: tag.id }, 'tag delete should cascade join rows');

  const workflow = await insertOne('workflows', { church_id: churchA.id, name: `Delete Workflow ${suffix}` });
  const step = await insertOne('workflow_steps', { church_id: churchA.id, workflow_id: workflow.id, name: 'Delete Step', position: 1 });
  const card = await insertOne('workflow_cards', { church_id: churchA.id, person_id: person.id, workflow_id: workflow.id, current_step_id: step.id });
  await admin.from('workflow_steps').delete().eq('id', step.id);
  const { data: cardAfterStepDelete } = await admin
    .from('workflow_cards')
    .select('current_step_id')
    .eq('id', card.id)
    .single();
  assert.equal(cardAfterStepDelete.current_step_id, null);

  const webhook = await insertOne('webhooks', { church_id: churchA.id, name: `Delete Webhook ${suffix}`, url: 'https://example.com/delete', events: ['person.updated'], secret: 'secret-delete' });
  const delivery = await insertOne('webhook_deliveries', { church_id: churchA.id, webhook_id: webhook.id, event_type: 'person.updated', payload: { delete: true } });
  await admin.from('webhooks').delete().eq('id', webhook.id);
  await assertNoRows('webhook_deliveries', { id: delivery.id }, 'webhook delete should preserve existing cascade behavior');
});
