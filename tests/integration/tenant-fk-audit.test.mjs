// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
import ws from 'ws';

dotenv.config({ path: '.env.local', quiet: true });

const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';

const tenantRelationshipPairs = [
  ['people', 'households', 'people_church_household_fk'],
  ['person_tags', 'people', 'person_tags_church_person_fk'],
  ['person_tags', 'tags', 'person_tags_church_tag_fk'],
  ['person_field_values', 'people', 'person_field_values_church_person_fk'],
  ['person_field_values', 'field_definitions', 'person_field_values_church_field_definition_fk'],
  ['notes', 'people', 'notes_church_person_fk'],
  ['person_events', 'people', 'person_events_church_person_fk'],
  ['person_claim_requests', 'people', 'person_claim_requests_church_person_fk'],
  ['person_proposed_updates', 'people', 'person_proposed_updates_church_person_fk'],
  ['person_roles', 'people', 'person_roles_church_person_fk'],
  ['person_roles', 'roles', 'person_roles_church_role_fk'],
  ['workflow_steps', 'workflows', 'workflow_steps_church_workflow_fk'],
  ['workflow_pulse_configs', 'workflows', 'workflow_pulse_configs_church_workflow_fk'],
  ['tags', 'workflows', 'tags_church_target_workflow_fk'],
  ['events', 'workflows', 'events_church_target_workflow_fk'],
  ['workflow_cards', 'people', 'workflow_cards_church_person_fk'],
  ['workflow_cards', 'workflows', 'workflow_cards_church_workflow_fk'],
  ['workflow_cards', 'workflow_steps', 'workflow_cards_church_current_step_fk'],
  ['list_people', 'lists', 'list_people_church_list_fk'],
  ['list_people', 'people', 'list_people_church_person_fk'],
  ['event_registrations', 'events', 'event_registrations_church_event_fk'],
  ['event_registrations', 'people', 'event_registrations_church_person_fk'],
  ['person_user_links', 'people', 'person_user_links_church_person_fk'],
  ['connect_forms', 'tags', 'connect_forms_church_target_tag_fk'],
  ['connect_forms', 'workflows', 'connect_forms_church_target_workflow_fk'],
  ['connect_form_submissions', 'connect_forms', 'connect_form_submissions_church_form_fk'],
  ['connect_form_submissions', 'people', 'connect_form_submissions_church_person_fk'],
  ['webhook_deliveries', 'webhooks', 'webhook_deliveries_church_webhook_fk'],
];

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const ignoredSourceDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'playwright-report',
  'test-results',
]);

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

async function collectSourceFiles(directory = '.') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredSourceDirectories.has(entry.name)) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function findSourceTable(node) {
  if (ts.isCallExpression(node)) {
    const expression = node.expression;
    if (ts.isPropertyAccessExpression(expression)) {
      if (
        expression.name.text === 'from'
        && node.arguments.length === 1
        && ts.isStringLiteral(node.arguments[0])
      ) {
        return node.arguments[0].text;
      }
      return findSourceTable(expression.expression);
    }
  }

  if (ts.isPropertyAccessExpression(node)) {
    return findSourceTable(node.expression);
  }

  return null;
}

function findAmbiguousEmbeds(sourcePath, source) {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const violations = [];

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'select'
    ) {
      const sourceTable = findSourceTable(node.expression.expression);
      const selectionNode = node.arguments[0];
      const isStaticSelection = selectionNode && (
        ts.isStringLiteral(selectionNode)
        || ts.isNoSubstitutionTemplateLiteral(selectionNode)
      );

      if (sourceTable && isStaticSelection) {
        for (const [childTable, parentTable, relationship] of tenantRelationshipPairs) {
          const embeddedTable = sourceTable === childTable
            ? parentTable
            : sourceTable === parentTable
              ? childTable
              : null;
          if (!embeddedTable) continue;

          const embedPattern = new RegExp(
            `(?:\\b[A-Za-z_][A-Za-z0-9_]*\\s*:\\s*)?\\b${embeddedTable}\\b((?:![A-Za-z0-9_]+)*)\\s*\\(`,
            'g'
          );
          for (const match of selectionNode.text.matchAll(embedPattern)) {
            const hints = match[1].split('!').filter(Boolean);
            if (hints.includes(relationship)) continue;

            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push(
              `${sourcePath}:${line + 1} ${sourceTable}->${embeddedTable} must use !${relationship}`
            );
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
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

test('tenant-aware relationship hints execute for dashboard and developer queries', async () => {
  const event = await insertOne('events', {
    church_id: churchA.id,
    slug: `embed-event-${suffix}`,
    name: `Embed Event ${suffix}`,
    start_at: new Date(Date.now() + 60_000).toISOString(),
    status: 'published',
  });
  const registration = await insertOne('event_registrations', {
    church_id: churchA.id,
    event_id: event.id,
    first_name: 'Embed',
    last_name: 'Registrant',
    email: `embed-registration-${suffix}@test.com`,
  });
  const webhook = await insertOne('webhooks', {
    church_id: churchA.id,
    name: `Embed Webhook ${suffix}`,
    url: 'https://example.com/embed-webhook',
    events: ['person.updated'],
    secret: 'embed-secret',
  });
  const delivery = await insertOne('webhook_deliveries', {
    church_id: churchA.id,
    webhook_id: webhook.id,
    event_type: 'person.updated',
    payload: { ok: true },
  });

  const [registrationResult, deliveryResult] = await Promise.all([
    admin
      .from('event_registrations')
      .select(`
        id,
        events!event_registrations_church_event_fk!inner(id, church_id)
      `)
      .eq('id', registration.id)
      .eq('church_id', churchA.id)
      .eq('events.church_id', churchA.id)
      .single(),
    admin
      .from('webhook_deliveries')
      .select(`
        id,
        webhooks!webhook_deliveries_church_webhook_fk!inner(id, church_id)
      `)
      .eq('id', delivery.id)
      .eq('church_id', churchA.id)
      .eq('webhooks.church_id', churchA.id)
      .single(),
  ]);

  if (registrationResult.error) throw registrationResult.error;
  if (deliveryResult.error) throw deliveryResult.error;
  assert.equal(registrationResult.data.events.id, event.id);
  assert.equal(deliveryResult.data.webhooks.id, webhook.id);
});

test('source queries avoid bare embeds for every tenant-aware relationship pair', async () => {
  const sourceFiles = await collectSourceFiles();
  const violations = [];

  for (const sourcePath of sourceFiles) {
    const source = await readFile(sourcePath, 'utf8');
    violations.push(...findAmbiguousEmbeds(sourcePath, source));
  }

  assert.deepEqual(violations, []);
});

test('source guard flags known ambiguous pairs without flagging single relationships', () => {
  const source = `
    const registrations = supabase
      .from('event_registrations')
      .select('events!inner(id)');
    const memberships = supabase
      .from('church_memberships')
      .select('churches!inner(id)');
  `;

  assert.deepEqual(findAmbiguousEmbeds('fixture.ts', source), [
    'fixture.ts:2 event_registrations->events must use !event_registrations_church_event_fk',
  ]);
});

test('highest-risk pages retain explicit or embed-free tenant-safe queries', async () => {
  const cases = [
    {
      path: 'src/app/(admin)/dashboard/page.tsx',
      expected: 'events!event_registrations_church_event_fk!inner(',
    },
    {
      path: 'src/app/(admin)/developer/page.tsx',
      expected: 'webhooks!webhook_deliveries_church_webhook_fk!inner(',
    },
    {
      path: 'src/app/(admin)/lists/[id]/page.tsx',
      expected: 'people!list_people_church_person_fk (',
    },
  ];

  for (const sourceCase of cases) {
    const source = await readFile(sourceCase.path, 'utf8');
    assert.ok(
      source.includes(sourceCase.expected),
      `${sourceCase.path} must retain ${sourceCase.expected}`
    );
  }

  const teamSource = await readFile('src/lib/team.ts', 'utf8');
  assert.match(teamSource, /from\('person_claim_requests'\)/);
  assert.match(teamSource, /from\('people'\)/);
  assert.doesNotMatch(teamSource, /people(?:!inner)?\s*\(/);

  const peopleDirectorySource = await readFile('src/lib/queries/people.ts', 'utf8');
  assert.match(peopleDirectorySource, /from\('people'\)/);
  assert.match(peopleDirectorySource, /from\('person_tags'\)/);
  assert.doesNotMatch(peopleDirectorySource, /person_tags(?:!inner)?\s*\(/);
});
