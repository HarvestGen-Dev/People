// <!-- AGENT: INTEGRATION -->
import { expect, type Page } from '@playwright/test';

export const TEST_PASSWORD = 'Password123!';

export async function loginThroughUi(
  page: Page,
  user: { email: string; password?: string },
  expectedPath: RegExp = /\/(dashboard|portal|platform|claim-pending)$/
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password ?? TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(expectedPath);
}

export async function logoutThroughUi(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}
