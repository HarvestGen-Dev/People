// <!-- AGENT: INTEGRATION -->
import { expect, type Page } from '@playwright/test';

export async function expectNoServerComponentError(page: Page) {
  await expect(
    page.getByText('An error occurred in the Server Components render', { exact: false })
  ).toHaveCount(0);
  await expect(page.getByText('Application error', { exact: false })).toHaveCount(0);
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
