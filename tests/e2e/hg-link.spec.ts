// <!-- AGENT: INTEGRATION -->
import { expect, test } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { expectNoHorizontalOverflow, expectNoServerComponentError } from './helpers/assertions';
import { E2ETenant, type TestUser } from './helpers/seed-tenant';
import { defaultFormSeeds } from '../../src/lib/hg-link/formSchema';
import { defaultHgLinkContent } from '../../src/lib/hg-link/contentSchema';

let tenant: E2ETenant;
let admin: TestUser;

test.beforeAll(async () => {
  tenant = await E2ETenant.create('HG Link');
  admin = await tenant.createUser('admin', 'hg-link-admin');

  for (const seed of defaultFormSeeds()) {
    const { error } = await tenant.admin.from('connect_forms').insert({
      church_id: tenant.churchId, slug: seed.slug, title: seed.title, description: seed.description,
      kind: seed.kind, definition: seed.definition, definition_version: 1, is_active: true,
    });
    if (error) throw error;
  }
  const { error } = await tenant.admin.from('hg_link_revisions').insert({
    church_id: tenant.churchId, status: 'published', version: 1, content: defaultHgLinkContent(), published_at: new Date().toISOString(),
  });
  if (error) throw error;
});

test.afterAll(async () => {
  await tenant.cleanup();
});

test('public HG Link page renders all seven cards without signing in', async ({ page }) => {
  await page.goto(`/link/${tenant.churchSlug}`);
  await expectNoServerComponentError(page);
  await expect(page.getByRole('heading', { level: 1, name: 'HG Link' })).toBeVisible();
  for (const title of ['I’m New To Church!', 'I Just Became A Christian', 'I Want To Be Water Baptised', 'I Want To Serve', 'Drip & Brew', 'Kids Gen', 'More on HarvestGen']) {
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Drip & Brew' })).toHaveAttribute('href', 'https://dripnbrew.harvestgen.org/');
});

test('layout works on desktop and mobile widths', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/link/${tenant.churchSlug}`);
  await expect(page.getByRole('heading', { level: 1, name: 'HG Link' })).toBeVisible();
  const desktopTops = await page.locator('section[aria-label="Ways to connect"] > a').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(desktopTops).size).toBeLessThan(desktopTops.length); // several cards share a row
  await expectNoHorizontalOverflow(page);

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true });
  try {
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`/link/${tenant.churchSlug}`);
    await expect(mobilePage.getByRole('heading', { level: 1, name: 'HG Link' })).toBeVisible();
    const mobileTops = await mobilePage.locator('section[aria-label="Ways to connect"] > a').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(mobileTops).size).toBe(mobileTops.length); // one column
    await expectNoHorizontalOverflow(mobilePage);
  } finally {
    await mobileContext.close();
  }
});

test('keyboard users can skip to content and reach the cards', async ({ page }) => {
  await page.goto(`/link/${tenant.churchSlug}`);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'I’m New To Church!' })).toBeFocused();
});

test('form shows accessible errors, accepts one Yes/No answer, and stores the submission', async ({ page }) => {
  await page.goto(`/link/${tenant.churchSlug}/new-to-church`);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('This is required').first()).toBeVisible();
  await expect(page.getByLabel('First name')).toBeFocused();
  await expect(page.getByLabel('First name')).toHaveAttribute('aria-invalid', 'true');

  const email = `hg-link-${tenant.suffix}@test.invalid`;
  await page.getByLabel('First name').fill('Newcomer');
  await page.getByLabel('Last name').fill(`Test ${tenant.suffix}`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Phone number').fill('+60123450099');
  // Only ONE of the two Yes/No questions is answered: this used to block submission.
  await page.getByRole('group', { name: /Looking for a church/ }).getByLabel('Yes').check();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('status')).toContainText('Welcome');

  const { data } = await tenant.admin.from('people').select('id').eq('church_id', tenant.churchId).eq('email', email);
  expect(data).toHaveLength(1);
  const { data: subs } = await tenant.admin.from('connect_form_submissions').select('answers').eq('church_id', tenant.churchId).eq('person_id', data![0].id);
  expect(subs![0].answers.looking_for_church).toBe('yes');
});

test('administrator edits a card: preview updates immediately, draft stays private, publish goes live', async ({ page }) => {
  await loginThroughUi(page, admin);
  await page.goto('/settings/hg-link');
  await expectNoServerComponentError(page);

  await page.getByRole('button', { name: 'Edit Kids Gen' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Kids Gen Updated');
  await expect(page.locator('#preview-heading').locator('xpath=ancestor::section').getByText('Kids Gen Updated')).toBeVisible();

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved').first()).toBeVisible();
  const publicPage = await page.context().newPage();
  await publicPage.goto(`/link/${tenant.churchSlug}`);
  await expect(publicPage.getByRole('link', { name: 'Kids Gen', exact: true })).toBeVisible();
  await expect(publicPage.getByText('Kids Gen Updated')).toHaveCount(0);

  await page.getByRole('button', { name: 'Publish changes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Showing the live page.')).toBeVisible();
  await publicPage.reload();
  await expect(publicPage.getByRole('link', { name: 'Kids Gen Updated' })).toBeVisible();
});

test('card reordering is keyboard accessible', async ({ page }) => {
  await loginThroughUi(page, admin);
  await page.goto('/settings/hg-link');
  const down = page.getByRole('button', { name: 'Move I’m New To Church! down' });
  await down.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'moved to position 2' })).toHaveCount(1);
});
