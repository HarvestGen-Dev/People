// <!-- AGENT: INTEGRATION -->
import { expect, test, type Page } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { escapeRegExp } from './helpers/assertions';
import { E2ETenant, type TestUser } from './helpers/seed-tenant';
import { insertOne } from './helpers/supabase-admin';

let tenant: E2ETenant;
let owner: TestUser;
let personName: string;
let workflowName: string;
let listName: string;

async function seedTenant() {
  tenant = await E2ETenant.create('Navigation Loading');
  owner = await tenant.createUser('owner', 'navigation-owner');
  personName = `Nav Person ${tenant.suffix}`;
  workflowName = `Navigation Workflow ${tenant.suffix}`;
  listName = `Navigation List ${tenant.suffix}`;

  const person = await insertOne<{ id: string }>(tenant.admin, 'people', {
    church_id: tenant.churchId,
    first_name: 'Nav',
    last_name: `Person ${tenant.suffix}`,
    email: `person-${tenant.suffix}@test.invalid`,
    status: 'visitor',
  });

  const workflow = await insertOne<{ id: string }>(tenant.admin, 'workflows', {
    church_id: tenant.churchId,
    name: workflowName,
    description: 'E2E workflow for navigation progress coverage',
  });

  const step = await insertOne<{ id: string }>(tenant.admin, 'workflow_steps', {
    church_id: tenant.churchId,
    workflow_id: workflow.id,
    name: 'Follow up',
    position: 1,
  });

  await insertOne(tenant.admin, 'workflow_cards', {
    church_id: tenant.churchId,
    workflow_id: workflow.id,
    current_step_id: step.id,
    person_id: person.id,
  });

  const list = await insertOne<{ id: string }>(tenant.admin, 'lists', {
    church_id: tenant.churchId,
    name: listName,
    type: 'static',
  });

  await insertOne(tenant.admin, 'list_people', {
    church_id: tenant.churchId,
    list_id: list.id,
    person_id: person.id,
  });
}

async function cleanupTenant() {
  await tenant.cleanup();
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
  await loginThroughUi(page, owner, /\/dashboard$/);

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
