// <!-- AGENT: INTEGRATION -->
import { expect, test, type Browser, type Page } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { expectNoServerComponentError, escapeRegExp } from './helpers/assertions';
import { cleanupTenants, E2ETenant, type TestUser } from './helpers/seed-tenant';
import { insertOne } from './helpers/supabase-admin';

type SeededRoutes = {
  person: { id: string; display_id: string; name: string; email: string };
  tag: { id: string; name: string };
  workflow: { id: string; display_id: string; name: string; cardId: string };
  list: { id: string; display_id: string; name: string };
  event: { id: string; display_id: string; name: string; registrationId: string };
  webhookName: string;
  claimPersonName: string;
};

let tenantA: E2ETenant;
let tenantB: E2ETenant;
let owner: TestUser;
let adminUser: TestUser;
let pastoral: TestUser;
let staff: TestUser;
let viewer: TestUser;
let workflowManager: TestUser;
let legacyMember: TestUser;
let portalUser: TestUser;
let routesA: SeededRoutes;
let routesB: SeededRoutes;
const baseURL = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3217}`;

async function seedRenderData(tenant: E2ETenant, label: string): Promise<SeededRoutes> {
  const person = await tenant.createPerson({
    first_name: label,
    last_name: `Person ${tenant.suffix}`,
    email: `${label.toLowerCase()}-person-${tenant.suffix}@test.invalid`,
  });
  const personName = `${person.first_name} ${person.last_name}`;
  const tag = await tenant.createTag(`${label} Tag ${tenant.suffix}`);
  await insertOne(tenant.admin, 'person_tags', {
    church_id: tenant.churchId,
    person_id: person.id,
    tag_id: tag.id,
  });

  const workflow = await tenant.createWorkflow(`${label} Workflow ${tenant.suffix}`, ['Review']);
  const card = await insertOne<{ id: string }>(tenant.admin, 'workflow_cards', {
    church_id: tenant.churchId,
    workflow_id: workflow.id,
    current_step_id: workflow.steps[0].id,
    person_id: person.id,
    notes: 'Synthetic tenant-scoped card',
  });

  const list = await insertOne<{ id: string; display_id: string; name: string }>(
    tenant.admin,
    'lists',
    { church_id: tenant.churchId, name: `${label} Static List ${tenant.suffix}`, type: 'static' },
    'id, display_id, name'
  );
  await insertOne(tenant.admin, 'list_people', {
    church_id: tenant.churchId,
    list_id: list.id,
    person_id: person.id,
  });

  const event = await tenant.createEvent({ name: `${label} Pending Event ${tenant.suffix}`, price: 10 });
  const registration = await insertOne<{ id: string }>(tenant.admin, 'event_registrations', {
    church_id: tenant.churchId,
    event_id: event.id,
    first_name: label,
    last_name: `Registrant ${tenant.suffix}`,
    email: `${label.toLowerCase()}-registration-${tenant.suffix}@test.invalid`,
    phone: '+60123450004',
    guests: 0,
    amount_due: 10,
    paid_checkbox: true,
    status: 'pending_review',
  });

  const webhookName = `${label} Failed Webhook ${tenant.suffix}`;
  const webhook = await insertOne<{ id: string }>(tenant.admin, 'webhooks', {
    church_id: tenant.churchId,
    name: webhookName,
    url: 'https://webhook.test.invalid/e2e',
    events: ['person.created'],
    secret: 'synthetic-e2e-secret',
    is_active: true,
  });
  await insertOne(tenant.admin, 'webhook_deliveries', {
    church_id: tenant.churchId,
    webhook_id: webhook.id,
    event_type: 'person.created',
    payload: { event: 'person.created', synthetic: true },
    response_status: 503,
    error_message: 'Synthetic unavailable response',
    failed_at: new Date().toISOString(),
    status: 'permanently_failed',
    attempt_count: 5,
    last_status_code: 503,
    last_error: 'Synthetic unavailable response',
  });

  const claimPerson = await tenant.createPerson({
    first_name: `${label} Claim`,
    last_name: `Person ${tenant.suffix}`,
    email: `${label.toLowerCase()}-claim-${tenant.suffix}@test.invalid`,
  });
  const claimUser = await tenant.createAuthUser(`${label.toLowerCase()}-claim-account`);
  await insertOne(tenant.admin, 'person_claim_requests', {
    church_id: tenant.churchId,
    person_id: claimPerson.id,
    user_id: claimUser.id,
    email: claimUser.email,
    status: 'pending',
  });

  return {
    person: { id: person.id, display_id: person.display_id, name: personName, email: person.email! },
    tag,
    workflow: { id: workflow.id, display_id: workflow.display_id, name: workflow.name, cardId: card.id },
    list,
    event: { id: event.id, display_id: event.display_id, name: event.name, registrationId: registration.id },
    webhookName,
    claimPersonName: `${claimPerson.first_name} ${claimPerson.last_name}`,
  };
}

async function withUserPage(
  browser: Browser,
  user: TestUser,
  callback: (page: Page) => Promise<void>,
  expectedPath: RegExp = /\/dashboard$/
) {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await loginThroughUi(page, user, expectedPath);
    await callback(page);
  } finally {
    await context.close();
  }
}

test.beforeAll(async () => {
  tenantA = await E2ETenant.create('Authorization A');
  tenantB = await E2ETenant.create('Authorization B');
  [owner, adminUser, pastoral, staff, viewer, workflowManager, legacyMember] = await Promise.all([
    tenantA.createUser('owner', 'matrix-owner'),
    tenantA.createUser('admin', 'matrix-admin'),
    tenantA.createUser('pastoral', 'matrix-pastoral'),
    tenantA.createUser('staff', 'matrix-staff'),
    tenantA.createUser('viewer', 'matrix-viewer'),
    tenantA.createUser('workflow_manager', 'matrix-workflow-manager'),
    tenantA.createUser('member', 'matrix-legacy-member'),
  ]);
  routesA = await seedRenderData(tenantA, 'Alpha');
  routesB = await seedRenderData(tenantB, 'Beta');
  const portalPerson = await tenantA.createPerson({
    first_name: 'Portal',
    last_name: `Person ${tenantA.suffix}`,
    email: `portal-person-${tenantA.suffix}@test.invalid`,
  });
  portalUser = await tenantA.createPortalUser(portalPerson);
});

test.afterAll(async () => {
  await cleanupTenants([tenantA, tenantB]);
});

test('high-risk Server Component routes render tenant-scoped migrated relationships', async ({ page }) => {
  await loginThroughUi(page, owner, /\/dashboard$/);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Ministry overview' })).toBeVisible();
  await expect(page.getByText(routesA.event.name, { exact: true })).toBeVisible();
  await expectNoServerComponentError(page);

  await page.goto('/developer');
  await expect(page.getByRole('heading', { name: 'Developer API' }).first()).toBeVisible();
  await expect(page.getByText(routesA.webhookName, { exact: true })).toBeVisible();
  await expectNoServerComponentError(page);

  await page.goto('/settings/team');
  await expect(page.getByRole('heading', { name: 'Team & invitations' }).first()).toBeVisible();
  await expect(page.getByText(routesA.claimPersonName, { exact: true })).toBeVisible();
  await expectNoServerComponentError(page);

  await page.goto(`/lists/${routesA.list.display_id}`);
  await expect(page.getByText(routesA.person.name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expectNoServerComponentError(page);

  await page.goto('/people');
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.getByText(routesA.person.name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.goto(`/people?tag=${routesA.tag.id}`);
  await expect(page.getByText(routesA.person.name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('table').getByText(routesA.tag.name, { exact: true })).toBeVisible();
  await expectNoServerComponentError(page);

  await page.goto(`/workflows/${routesA.workflow.display_id}`);
  await expect(page.getByRole('heading', { name: routesA.workflow.name })).toBeVisible();
  await expect(page.getByText(routesA.person.name, { exact: true })).toBeVisible();
  await expectNoServerComponentError(page);

  await page.goto(`/events/${routesA.event.display_id}/registrations`);
  await expect(page.getByText(routesA.event.name, { exact: false })).toBeVisible();
  await expect(
    page.getByRole('table').getByText(`alpha-registration-${tenantA.suffix}@test.invalid`)
  ).toBeVisible();
  await expectNoServerComponentError(page);
});

test('role matrix enforces browser navigation and direct route boundaries', async ({ browser }) => {
  for (const user of [owner, adminUser]) {
    await withUserPage(browser, user, async (page) => {
      await page.goto('/developer');
      await expect(page.getByRole('heading', { name: 'Developer API' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Developer', exact: true })).toBeVisible();
    });
  }

  for (const user of [pastoral, staff, viewer, legacyMember]) {
    await withUserPage(browser, user, async (page) => {
      await expect(page.getByRole('heading', { name: 'Ministry overview' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Developer', exact: true })).toHaveCount(0);
      await page.goto('/developer');
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto('/settings/team');
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }

  await withUserPage(browser, viewer, async (page) => {
    await page.goto('/people');
    await expect(page.getByRole('table').getByText(routesA.person.name, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add person' })).toHaveCount(0);
    await page.goto(`/people/${routesA.person.display_id}`);
    await expect(page.getByRole('link', { name: 'Edit person' })).toHaveCount(0);
    const photoMutation = await page.context().request.post(
      `/api/admin/people/${routesA.person.id}/photo`,
      { multipart: { file: { name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('x') } } }
    );
    expect(photoMutation.status()).toBe(403);
    const approvalMutation = await page.context().request.post(
      `/api/admin/registrations/${routesA.event.registrationId}/approve`
    );
    expect(approvalMutation.status()).toBe(403);
  });

  await withUserPage(browser, workflowManager, async (page) => {
    await page.goto('/people');
    await expect(page).toHaveURL(/\/workflows$/);
    await expect(page.getByRole('button', { name: 'New workflow' })).toHaveCount(0);
    await page.goto(`/workflows/${routesA.workflow.display_id}`);
    await expect(page.getByRole('button', { name: 'Add step' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add person', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: new RegExp(escapeRegExp(routesA.person.name)) }).click();
    await expect(page.getByRole('button', { name: 'Mark as complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.goto('/developer');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/settings/team');
    await expect(page).toHaveURL(/\/dashboard$/);

    const photoMutation = await page.context().request.post(
      `/api/admin/people/${routesA.person.id}/photo`,
      { multipart: { file: { name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('x') } } }
    );
    expect(photoMutation.status()).toBe(403);
    const approvalMutation = await page.context().request.post(
      `/api/admin/registrations/${routesA.event.registrationId}/approve`
    );
    expect(approvalMutation.status()).toBe(403);
  });

  await withUserPage(
    browser,
    portalUser,
    async (page) => {
      await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/portal$/);
      const adminSearch = await page.context().request.get('/api/admin/people/search?q=synthetic');
      expect(adminSearch.status()).toBe(403);
    },
    /\/portal$/
  );

  const anonymousContext = await browser.newContext({ baseURL });
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto('/dashboard');
  await expect(anonymousPage).toHaveURL(/\/login$/);
  await anonymousContext.close();
});

test('Church A cannot read or mutate Church B resources by URL or identifier', async ({ page }) => {
  await loginThroughUi(page, owner, /\/dashboard$/);
  const protectedUrls = [
    `/people/${routesB.person.display_id}`,
    `/events/${routesB.event.display_id}/registrations`,
    `/workflows/${routesB.workflow.display_id}`,
    `/lists/${routesB.list.display_id}`,
  ];

  for (const url of protectedUrls) {
    await page.goto(url);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(new RegExp(escapeRegExp(routesB.person.name), 'i'));
    expect(body).not.toMatch(new RegExp(escapeRegExp(routesB.person.email), 'i'));
    expect(body).not.toMatch(new RegExp(escapeRegExp(routesB.event.name), 'i'));
    expect(body).not.toMatch(new RegExp(escapeRegExp(routesB.workflow.name), 'i'));
    expect(body).not.toMatch(/Synthetic unavailable response/i);
    await expectNoServerComponentError(page);
  }

  const moveAttempt = await page.context().request.patch(
    `/api/admin/workflow-cards/${routesB.workflow.cardId}`,
    {
      data: { current_step_id: routesB.workflow.id },
    }
  );
  expect(moveAttempt.status()).toBe(404);
  expect(await moveAttempt.text()).not.toContain(routesB.person.name);

  await page.goto('/settings/team');
  await expect(page.getByText(routesB.claimPersonName, { exact: true })).toHaveCount(0);
});
