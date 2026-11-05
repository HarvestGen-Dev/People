// <!-- AGENT: INTEGRATION -->
import { expect, test } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { escapeRegExp } from './helpers/assertions';
import { cleanupTenants, E2ETenant, type TestUser } from './helpers/seed-tenant';
import { insertOne } from './helpers/supabase-admin';

let tenant: E2ETenant;
let otherTenant: E2ETenant;
let owner: TestUser;
let viewer: TestUser;
let workflowManager: TestUser;
let featured: { id: string; display_id: string; first_name: string; last_name: string; email: string | null };
let foreign: { display_id: string; first_name: string };
let cardId: string;
let tagId: string;

test.beforeAll(async () => {
  tenant = await E2ETenant.create('People redesign');
  otherTenant = await E2ETenant.create('Other redesign tenant');
  [owner, viewer, workflowManager] = await Promise.all([
    tenant.createUser('owner', 'redesign-owner'),
    tenant.createUser('viewer', 'redesign-viewer'),
    tenant.createUser('workflow_manager', 'redesign-workflow-manager'),
  ]);
  featured = await tenant.createPerson({ first_name: 'Mira', last_name: 'Directory', email: 'mira-directory@test.invalid', status: 'active' });
  foreign = await otherTenant.createPerson({ first_name: 'Hidden', last_name: 'Directory', email: 'hidden-directory@test.invalid' });
  const { error } = await tenant.admin.from('people').insert(Array.from({ length: 51 }, (_, index) => ({
    church_id: tenant.churchId,
    first_name: 'Directory',
    last_name: `Page ${String(index + 1).padStart(2, '0')}`,
    email: `paged-${index + 1}@${tenant.suffix}.test.invalid`,
    status: 'visitor',
  })));
  if (error) throw error;
  const tag = await tenant.createTag('Welcome team');
  tagId = tag.id;
  await insertOne(tenant.admin, 'person_tags', { church_id: tenant.churchId, person_id: featured.id, tag_id: tag.id });
  const workflow = await tenant.createWorkflow('New visitor care', ['Welcome call']);
  const card = await insertOne<{ id: string }>(tenant.admin, 'workflow_cards', {
    church_id: tenant.churchId,
    workflow_id: workflow.id,
    current_step_id: workflow.steps[0].id,
    person_id: featured.id,
    due_date: '2020-01-01',
  });
  cardId = card.id;
});

test.afterAll(async () => {
  await cleanupTenants([tenant, otherTenant]);
});

test('directory search, filters, and pagination preserve server results and tenant scope', async ({ page }) => {
  await loginThroughUi(page, owner, /\/dashboard$/);
  await page.goto('/people');
  const table = page.getByRole('table', { name: 'People' });
  await expect(page.getByRole('status').filter({ hasText: 'Showing 1–50 of 52' })).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(51);
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('status').filter({ hasText: 'Showing 51–52 of 52' })).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByText('Directory Page 51', { exact: true })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search people' }).fill('mira-directory');
  await expect(page).toHaveURL(/\/people\?search=mira-directory$/);
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText('Mira Directory', { exact: true })).toBeVisible();
  await page.getByLabel('Filter by status').selectOption('visitor');
  await expect(page.getByRole('heading', { name: 'No people found' })).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await page.getByLabel('Filter by tag').selectOption(tagId);
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText('Welcome team', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByLabel('Filter by tag')).toHaveValue('');
  await expect(table.getByRole('row')).toHaveCount(51);
  await page.goto(`/people?search=${foreign.first_name}&preview=${foreign.display_id}`);
  await expect(page.getByRole('heading', { name: 'No people found' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('profile preview traps focus, restores it on Escape, and honors viewer access', async ({ page }) => {
  await loginThroughUi(page, viewer, /\/dashboard$/);
  await page.goto(`/people?search=${encodeURIComponent(featured.email!)}`);
  const row = page.getByRole('table').getByRole('link', { name: /Mira Directory/ });
  await row.focus();
  await page.keyboard.press('Enter');
  const preview = page.getByRole('dialog', { name: 'Mira Directory' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Close profile preview' })).toBeFocused();
  await expect(preview.getByRole('link', { name: 'Edit profile' })).toHaveCount(0);
  await expect(preview.getByRole('link', { name: featured.email! })).toHaveAttribute('href', `mailto:${featured.email}`);
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => preview.evaluate(dialog => dialog.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(row).toBeFocused();
  await expect(page).toHaveURL(/\/people\?search=[^&]+$/);
  await row.click();
  await preview.getByRole('link', { name: 'View full profile' }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${escapeRegExp(featured.display_id)}$`));
});

test('follow-up completion persists and keeps boards and permissions intact', async ({ page, browser }) => {
  await loginThroughUi(page, workflowManager, /\/(dashboard|workflows)$/);
  await page.goto('/workflows');
  await expect(page.getByRole('button', { name: 'New workflow' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mira Directory', exact: true })).toBeVisible();
  const button = page.getByRole('button', { name: 'Complete follow-up for Mira Directory' });
  const context = await browser.newContext();
  try {
    const readonly = await context.newPage();
    await loginThroughUi(readonly, viewer, /\/dashboard$/);
    await readonly.goto('/workflows');
    await expect(readonly.getByRole('link', { name: 'Mira Directory', exact: true })).toBeVisible();
    await expect(readonly.getByRole('button', { name: /Complete follow-up/ })).toHaveCount(0);
  } finally {
    await context.close();
  }

  const done = page.waitForResponse(response => response.url().endsWith(`/workflow-cards/${cardId}/complete`));
  await button.click();
  expect((await done).ok()).toBeTruthy();
  await expect(button).toHaveCount(0);
  await page.getByRole('link', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Mira Directory', exact: true })).toBeVisible();
  const { data, error } = await tenant.admin.from('workflow_cards').select('completed_at').eq('id', cardId).single();
  expect(error).toBeNull();
  expect(data?.completed_at).toBeTruthy();
  await page.getByRole('link', { name: 'Workflow boards' }).click();
  await page.getByRole('link', { name: 'Open board' }).click();
  await expect(page.getByRole('heading', { name: 'New visitor care' })).toBeVisible();
});

test('list actions and event review use the existing routes and persist changes', async ({ page }) => {
  const list = await insertOne<{ id: string; display_id: string }>(tenant.admin, 'lists', {
    church_id: tenant.churchId, name: 'Sunday hosts', type: 'static',
  });
  const event = await tenant.createEvent({ name: 'Ministry lunch', price: 10 });
  await insertOne(tenant.admin, 'event_registrations', {
    church_id: tenant.churchId, event_id: event.id, first_name: 'Mira', last_name: 'Directory',
    email: featured.email, phone: '+60123450004', guests: 0, amount_due: 10, paid_checkbox: true, status: 'pending_review',
  });
  await loginThroughUi(page, owner, /\/dashboard$/);
  await page.goto('/events');
  const eventRow = page.getByRole('list', { name: 'Events', exact: true }).getByRole('listitem').filter({ hasText: 'Ministry lunch' });
  await eventRow.getByRole('link', { name: '1 to review' }).click();
  await expect(page).toHaveURL(/\/registrations\?status=pending_review$/);
  await expect(page.getByRole('table').getByText(featured.email!, { exact: true })).toBeVisible();

  await page.goto('/lists');
  const staticLists = page.getByRole('region', { name: 'Static lists' });
  await expect(staticLists.getByRole('link', { name: 'Sunday hosts' })).toHaveAttribute('href', `/lists/${list.display_id}`);
  page.once('dialog', dialog => dialog.accept());
  await staticLists.getByRole('button', { name: 'Delete Sunday hosts' }).click();
  await expect(staticLists.getByRole('link', { name: 'Sunday hosts' })).toHaveCount(0);
  const { data, error } = await tenant.admin.from('lists').select('id').eq('id', list.id).maybeSingle();
  expect(error).toBeNull();
  expect(data).toBeNull();

  await page.getByRole('button', { name: 'New list' }).click();
  const create = page.getByRole('dialog', { name: 'Create a list' });
  await create.getByLabel('List name').fill('New audience');
  await create.getByRole('radio', { name: /^Static/ }).check();
  await create.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/lists\/new\?type=static&name=New[+]audience$/);
});

test('workspace navigation and directory fit the five target widths', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await loginThroughUi(page, owner, /\/dashboard$/);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  const navigation = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await navigation.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(navigation).toBeHidden();

  for (const width of [375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
    if (width >= 768) await expect(menu).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('table').getByRole('link', { name: /Mira Directory/ }).click();
    const preview = page.getByRole('dialog', { name: 'Mira Directory' });
    await expect(preview).toBeVisible();
    const bounds = await preview.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeLessThanOrEqual(width);
    await preview.getByRole('button', { name: 'Close profile preview' }).click();
    await expect(page).toHaveURL(/\/people$/);
  }

  for (const [path, heading] of [
    ['/dashboard', 'Ministry overview'], ['/workflows', 'Follow-ups'], ['/workflows?view=boards', 'Follow-ups'],
    ['/events', 'Events'], ['/lists', 'Lists'], ['/settings', 'General settings'], ['/people/new', 'Add person'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    for (const width of [375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});
