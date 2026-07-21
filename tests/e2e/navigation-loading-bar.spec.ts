// <!-- AGENT: INTEGRATION -->
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'Password123!';
const email = `nav-loading-${suffix}@test.com`;
const churchName = `Navigation Loading ${suffix}`;
const personName = `Nav Person ${suffix}`;
const workflowName = `Navigation Workflow ${suffix}`;
const listName = `Navigation List ${suffix}`;

let admin: SupabaseClient;
let churchId: string | null = null;
let userId: string | null = null;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for e2e tests'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

async function insertOne<T extends Record<string, unknown>>(
  table: string,
  values: Record<string, unknown>,
  columns = '*'
) {
  const { data, error } = await admin
    .from(table)
    .insert(values)
    .select(columns)
    .single();

  if (error) throw error;
  return data as unknown as T;
}

async function seedTenant() {
  admin = createAdminClient();

  const church = await insertOne<{ id: string }>('churches', {
    slug: `nav-loading-${suffix}`,
    name: churchName,
  });
  churchId = church.id;

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (authError) throw authError;
  userId = authData.user.id;

  await insertOne('church_memberships', {
    church_id: churchId,
    user_id: userId,
    role: 'owner',
  });

  const person = await insertOne<{ id: string }>('people', {
    church_id: churchId,
    first_name: 'Nav',
    last_name: `Person ${suffix}`,
    email: `person-${suffix}@test.com`,
    status: 'visitor',
  });

  const workflow = await insertOne<{ id: string }>('workflows', {
    church_id: churchId,
    name: workflowName,
    description: 'E2E workflow for navigation progress coverage',
  });

  const step = await insertOne<{ id: string }>('workflow_steps', {
    church_id: churchId,
    workflow_id: workflow.id,
    name: 'Follow up',
    position: 1,
  });

  await insertOne('workflow_cards', {
    church_id: churchId,
    workflow_id: workflow.id,
    current_step_id: step.id,
    person_id: person.id,
  });

  const list = await insertOne<{ id: string }>('lists', {
    church_id: churchId,
    name: listName,
    type: 'static',
  });

  await insertOne('list_people', {
    church_id: churchId,
    list_id: list.id,
    person_id: person.id,
  });
}

async function cleanupTenant() {
  if (churchId) {
    await admin.from('churches').delete().eq('id', churchId);
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function expectProgressDuringNavigation(
  page: Page,
  action: () => Promise<unknown>,
  url: string | RegExp
) {
  const progress = page.getByRole('progressbar', { name: 'Page loading' });

  await action();
  await expect(progress.first()).toBeVisible();
  await page.waitForURL(url);
  await expect(progress).toHaveCount(0, { timeout: 10_000 });
}

test.beforeAll(seedTenant);
test.afterAll(cleanupTenant);

test('loading bar appears for link and programmatic page navigations', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');

  await expectProgressDuringNavigation(
    page,
    () => page.getByRole('link', { name: 'Workflows', exact: true }).click(),
    '**/workflows'
  );

  await expectProgressDuringNavigation(
    page,
    () => page.getByRole('button', { name: 'Open board' }).click(),
    /\/workflows\/[^/]+$/
  );
  await expect(page.getByRole('heading', { name: workflowName })).toBeVisible();

  await expectProgressDuringNavigation(
    page,
    () => page.getByRole('link', { name: 'People', exact: true }).click(),
    '**/people'
  );

  await page
    .getByRole('button', { name: new RegExp(`Actions for ${personName}`) })
    .click();
  await expectProgressDuringNavigation(
    page,
    () => page.getByRole('menuitem', { name: 'View profile' }).click(),
    /\/people\/[^/]+$/
  );

  await expectProgressDuringNavigation(
    page,
    () => page.getByRole('link', { name: 'Lists', exact: true }).click(),
    '**/lists'
  );

  await expectProgressDuringNavigation(
    page,
    () =>
      page
        .getByRole('button', { name: new RegExp(`^${escapeRegExp(listName)}`) })
        .click(),
    /\/lists\/[^/]+$/
  );
});
