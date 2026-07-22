// <!-- AGENT: INTEGRATION -->
import { expect, test, type Browser, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { loginThroughUi } from './helpers/auth';
import { cleanupTenants, E2ETenant, type TestUser } from './helpers/seed-tenant';
import { insertOne } from './helpers/supabase-admin';

let tenantA: E2ETenant;
let tenantB: E2ETenant;
let tenantC: E2ETenant;
let owner: TestUser;
let adminUser: TestUser;
let pastoral: TestUser;
let workflowManager: TestUser;
let staff: TestUser;
let viewer: TestUser;
let portal: TestUser;
let healthyOwner: TestUser;
let warningOwner: TestUser;
let platformAdmin: TestUser;
const execFileAsync = promisify(execFile);
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function withUserPage(
  browser: Browser,
  user: TestUser,
  callback: (page: Page) => Promise<void>,
  expectedPath: RegExp = /\/(dashboard|workflows|portal)$/
) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await loginThroughUi(page, user, expectedPath);
    await callback(page);
  } finally {
    await context.close();
  }
}

test.beforeAll(async () => {
  tenantA = await E2ETenant.create('Operational Health A');
  tenantB = await E2ETenant.create('Operational Health B');
  tenantC = await E2ETenant.create('Operational Health C');
  [owner, adminUser, pastoral, workflowManager, staff, viewer] = await Promise.all([
    tenantA.createUser('owner', 'operations-owner'),
    tenantA.createUser('admin', 'operations-admin'),
    tenantA.createUser('pastoral', 'operations-pastoral'),
    tenantA.createUser('workflow_manager', 'operations-workflow-manager'),
    tenantA.createUser('staff', 'operations-staff'),
    tenantA.createUser('viewer', 'operations-viewer'),
  ]);
  const portalPerson = await tenantA.createPerson({ first_name: 'Operations', last_name: 'Portal' });
  portal = await tenantA.createPortalUser(portalPerson, 'operations-portal');
  healthyOwner = await tenantB.createUser('owner', 'operations-healthy-owner');
  warningOwner = await tenantC.createUser('owner', 'operations-warning-owner');
  platformAdmin = await tenantA.createAuthUser('operations-platform-admin');
  await insertOne(tenantA.admin, 'platform_admins', {
    user_id: platformAdmin.id,
  });

  const event = await tenantA.createEvent({ name: `Operations Queue ${tenantA.suffix}`, price: 10 });
  const registration = await insertOne<{ id: string }>(tenantA.admin, 'event_registrations', {
    church_id: tenantA.churchId,
    event_id: event.id,
    first_name: 'Synthetic',
    last_name: 'Operator',
    email: `operations-registration-${tenantA.suffix}@test.invalid`,
    guests: 0,
    status: 'pending_review',
  });
  for (let index = 0; index < 3; index += 1) {
    await insertOne(tenantA.admin, 'operational_incidents', {
      church_id: tenantA.churchId,
      event_name: 'email.send.failed',
      severity: 'error',
      resource_type: 'event_registration',
      resource_id: registration.id,
      error_code: `synthetic_smtp_failure_${index}`,
      retryable: true,
    });
  }
  await insertOne(tenantC.admin, 'operational_incidents', {
    church_id: tenantC.churchId,
    event_name: 'registration.submit.failed',
    severity: 'error',
    resource_type: 'event',
    resource_id: null,
    error_code: 'synthetic_warning',
    retryable: true,
  });
});

test.afterAll(async () => {
  await cleanupTenants([tenantA, tenantB, tenantC]);
});

test('healthy and warning states remain distinct from critical', async ({ browser }) => {
  await withUserPage(browser, healthyOwner, async (page) => {
    await page.goto('/developer/operations');
    await expect(page.getByRole('status')).toContainText('Overall status: Healthy');
    await expect(page.getByLabel('Registrations status: Healthy')).toBeVisible();
  });
  await withUserPage(browser, warningOwner, async (page) => {
    await page.goto('/developer/operations');
    await expect(page.getByRole('status')).toContainText('Overall status: Warning');
    await expect(page.getByLabel('Registrations status: Warning')).toBeVisible();
  });
});

test('a failed summary renders unavailable instead of healthy', async ({ browser }) => {
  await execFileAsync('psql', [
    databaseUrl,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'REVOKE EXECUTE ON FUNCTION public.get_operational_email_health(uuid, timestamptz) FROM service_role;',
  ]);
  try {
    await withUserPage(browser, owner, async (page) => {
      await page.goto('/developer/operations');
      await expect(page.getByRole('status')).toContainText('Overall status: Unavailable');
      await expect(page.getByLabel('Email and SMTP status: Unavailable')).toBeVisible();
    });
  } finally {
    await execFileAsync('psql', [
      databaseUrl,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'GRANT EXECUTE ON FUNCTION public.get_operational_email_health(uuid, timestamptz) TO service_role;',
    ]);
  }
});

test('owner and admin see tenant-scoped operational health with accessible status and links', async ({ browser }) => {
  for (const user of [owner, adminUser]) {
    await withUserPage(browser, user, async (page) => {
      await page.goto('/developer/operations');
      await expect(page.getByRole('heading', { name: 'Operational health', exact: true })).toBeVisible();
      await expect(page.getByRole('status')).toContainText('Overall status: Critical');
      await expect(page.getByLabel('Email and SMTP status: Critical')).toBeVisible();
      await expect(page.getByText('SMTP failures (24h)').locator('..')).toContainText('3');
      await expect(page.getByRole('link', { name: 'Open management page' }).first()).toHaveAttribute('href', '/events');
      await expect(page.getByText(tenantB.churchName)).toHaveCount(0);
    });
  }
});

test('platform admin must explicitly select an existing church', async ({ browser }) => {
  await withUserPage(browser, platformAdmin, async (page) => {
    await page.goto('/developer/operations');
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole('heading', { name: 'Churches' })).toBeVisible();

    const selection = await page.request.post(
      `/api/platform/churches/${tenantA.churchId}/select`
    );
    expect(selection.ok()).toBe(true);

    await page.goto('/developer/operations');
    await expect(
      page.getByRole('heading', { name: 'Operational health', exact: true })
    ).toBeVisible();
    await expect(page.getByText(tenantA.churchName)).toBeVisible();
    await expect(page.getByText(tenantB.churchName)).toHaveCount(0);

    await page.context().addCookies([{
      name: 'people_church_id',
      value: crypto.randomUUID(),
      url: new URL(page.url()).origin,
      httpOnly: true,
      sameSite: 'Lax',
    }]);
    await page.goto('/developer/operations');
    await expect(page).toHaveURL(/\/platform$/);
  }, /\/platform$/);
});

test('restricted and anonymous users cannot access operational health directly', async ({ browser }) => {
  for (const user of [pastoral, workflowManager, staff, viewer]) {
    await withUserPage(browser, user, async (page) => {
      await page.goto('/developer/operations');
      await expect(page).toHaveURL(/\/(dashboard|workflows)$/);
      await expect(page.getByRole('heading', { name: 'Operational health' })).toHaveCount(0);
    });
  }
  await withUserPage(browser, portal, async (page) => {
    await page.goto('/developer/operations');
    await expect(page).toHaveURL(/\/portal$/);
  }, /\/portal$/);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/developer/operations');
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});

test('operational health remains usable without horizontal overflow on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  try {
    const page = await context.newPage();
    await loginThroughUi(page, owner, /\/dashboard$/);
    await page.goto('/developer/operations');
    await expect(page.getByRole('heading', { name: 'Operational health', exact: true })).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
    await expect(page.getByLabel('Email and SMTP status: Critical')).toContainText('Critical');
  } finally {
    await context.close();
  }
});
