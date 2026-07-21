// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
    .from('tenant_relationship_integrity_complete_audit')
    .select('relationship_key, invalid_row_count');
  if (error) throw error;
  return new Map(data.map((row) => [row.relationship_key, row.invalid_row_count]));
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
  for (const viewName of [
    'tenant_relationship_integrity_audit',
    'tenant_relationship_integrity_violations',
    'tenant_relationship_integrity_complete_audit',
    'tenant_relationship_integrity_complete_violations',
  ]) {
    const { error } = await anon
      .from(viewName)
      .select('relationship_key')
      .limit(1);

    assert.ok(error, `${viewName} should reject anon access`);
  }
});

test('tenant relationship audit reports zero violations for valid same-tenant rows', async () => {
  const [personA] = await Promise.all([
    insertOne('people', {
      church_id: churchA.id,
      first_name: 'Valid',
      last_name: 'Person',
      status: 'visitor',
    }),
  ]);

  const [tagA] = await Promise.all([
    insertOne('tags', {
      church_id: churchA.id,
      name: `Tag A ${suffix}`,
      color: '#2563eb',
    }),
  ]);

  const [fieldA] = await Promise.all([
    insertOne('field_definitions', {
      church_id: churchA.id,
      name: `Field A ${suffix}`,
      slug: `field_a_${suffix.replaceAll('-', '_')}`,
      field_type: 'text',
    }),
  ]);

  const [workflowA] = await Promise.all([
    insertOne('workflows', {
      church_id: churchA.id,
      name: `Workflow A ${suffix}`,
    }),
  ]);

  const [stepA] = await Promise.all([
    insertOne('workflow_steps', {
      church_id: churchA.id,
      workflow_id: workflowA.id,
      name: 'Step A',
      position: 1,
    }),
  ]);

  const [listA] = await Promise.all([
    insertOne('lists', {
      church_id: churchA.id,
      name: `List A ${suffix}`,
      type: 'static',
    }),
  ]);

  const [eventA] = await Promise.all([
    insertOne('events', {
      church_id: churchA.id,
      slug: `event-a-${suffix}`,
      name: `Event A ${suffix}`,
      start_at: new Date(Date.now() + 60_000).toISOString(),
      status: 'published',
    }),
  ]);

  await Promise.all([
    insertOne('connect_forms', {
      church_id: churchA.id,
      slug: `form-a-${suffix}`,
      title: 'Form A',
    }),
  ]);

  const [webhookA] = await Promise.all([
    insertOne('webhooks', {
      church_id: churchA.id,
      name: `Webhook A ${suffix}`,
      url: 'https://example.com/webhook-a',
      events: ['person.updated'],
      secret: 'secret-a',
    }),
  ]);

  const validInsertions = await Promise.all([
    admin.from('person_tags').insert({ church_id: churchA.id, person_id: personA.id, tag_id: tagA.id }),
    admin.from('person_field_values').insert({ church_id: churchA.id, person_id: personA.id, field_definition_id: fieldA.id, value: 'x' }),
    admin.from('notes').insert({ church_id: churchA.id, person_id: personA.id, content: 'Valid same-tenant note' }),
    admin.from('person_events').insert({ church_id: churchA.id, person_id: personA.id, source: 'manual', event_type: 'valid_test' }),
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
  assert.deepEqual(validInsertions.map((result) => result.error).filter(Boolean), []);

  const counts = await readAuditCounts();
  assert.equal(counts.size, 28);
  for (const [relationshipKey, invalidRowCount] of counts) {
    assert.equal(invalidRowCount, 0, `${relationshipKey} should have no violations`);
  }

  const { data: detailRows, error: detailError } = await admin
    .from('tenant_relationship_integrity_complete_violations')
    .select('relationship_key')
    .limit(1);
  if (detailError) throw detailError;
  assert.deepEqual(detailRows, []);
});

test('source queries disambiguate people embeds after tenant composite FKs', async () => {
  const riskyEmbeds = [
    {
      path: 'src/app/(admin)/dashboard/page.tsx',
      table: 'person_events',
      relationship: 'person_events_church_person_fk',
    },
    {
      path: 'src/app/portal/page.tsx',
      table: 'person_user_links',
      relationship: 'person_user_links_church_person_fk',
    },
    {
      path: 'src/app/api/admin/lists/[id]/export/route.ts',
      table: 'list_people',
      relationship: 'list_people_church_person_fk',
    },
    {
      path: 'src/app/(admin)/lists/[id]/page.tsx',
      table: 'list_people',
      relationship: 'list_people_church_person_fk',
    },
    {
      path: 'src/lib/team.ts',
      table: 'person_claim_requests',
      relationship: 'person_claim_requests_church_person_fk',
    },
  ];

  for (const { path, table, relationship } of riskyEmbeds) {
    const source = await readFile(path, 'utf8');
    const queryPattern = new RegExp(
      `from\\('${table}'\\)[\\s\\S]*?select\\([\\s\\S]*?people\\(`,
      'm'
    );
    const explicitRelationshipPattern = new RegExp(`people!${relationship}\\(`);

    assert.ok(
      !queryPattern.test(source) || explicitRelationshipPattern.test(source),
      `${path} must use people!${relationship}(...) or avoid embedding people from ${table}`
    );
  }
});
