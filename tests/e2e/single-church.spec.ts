// <!-- AGENT: INTEGRATION -->
import { expect, test } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { expectNoHorizontalOverflow } from './helpers/assertions';
import { E2ETenant, type TestUser } from './helpers/seed-tenant';

test.skip(!process.env.PEOPLE_CHURCH_SLUG, 'Run with npm run test:e2e:single-church');

let church: E2ETenant;
let otherChurch: E2ETenant;
let administrator: TestUser;

test.beforeAll(async () => {
  church = await E2ETenant.create('Single church browser');
  otherChurch = await E2ETenant.create('Other church browser');
  const { error } = await church.admin.from('churches')
    .update({ slug: process.env.PEOPLE_CHURCH_SLUG }).eq('id', church.churchId);
  if (error) throw error;
  administrator = await church.createAuthUser('single-church-administrator');
  const { error: platformError } = await church.admin.from('platform_admins')
    .insert({ user_id: administrator.id });
  if (platformError) throw platformError;
  await church.createPerson({ first_name: 'Configured church member' });
  await otherChurch.createPerson({ first_name: 'Other church member' });
});

test.afterAll(async () => {
  if (church) await church.cleanup();
  if (otherChurch) await otherChurch.cleanup();
});

test('administrator opens the church directly and navigation offers no church switching', async ({ page }) => {
  await loginThroughUi(page, administrator, /\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Platform', exact: true })).toHaveCount(0);
  await page.context().addCookies([{
    name: 'people_church_id', value: otherChurch.churchId,
    url: new URL(page.url()).origin, httpOnly: true, sameSite: 'Lax',
  }]);
  await page.goto('/platform');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/people');
  await expect(page.getByText('Configured church member', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Other church member', { exact: false })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: test.info().outputPath('single-church-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const navigation = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(navigation.getByRole('link', { name: 'Overview', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Platform', exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: test.info().outputPath('single-church-mobile.png'), fullPage: true });
});

test('public links open the configured church and refuse an unrelated church', async ({ page }) => {
  await page.goto('/link');
  await expect(page.getByRole('heading', { level: 1, name: 'HG Link' })).toBeVisible();
  await page.goto(`/link/${otherChurch.churchSlug}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'HG Link' })).toHaveCount(0);
});
