// <!-- AGENT: INTEGRATION -->
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/assertions';
import { E2ETenant } from './helpers/seed-tenant';

let tenant: E2ETenant;

test.beforeAll(async () => {
  tenant = await E2ETenant.create('Responsive Registration');
});

test.afterAll(async () => {
  await tenant.cleanup();
});

test('registration remains usable across supported viewports and states', async ({
  page,
  request,
}) => {
  const longEventName = `A Very Long Synthetic Registration Event Name That Must Wrap Cleanly ${tenant.suffix}`;
  const event = await tenant.createEvent({
    name: longEventName,
    capacity: 1,
    price: 0,
  });

  await page.goto(`/e/${event.slug}`);
  await expect(page.getByRole('heading', { name: longEventName })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  for (const label of ['First Name', 'Last Name', 'Email', 'Phone', 'Additional guests']) {
    await expect(page.getByLabel(label)).toBeVisible();
  }

  const registerButton = page.getByRole('button', { name: 'Register' });
  const buttonBox = await registerButton.boundingBox();
  expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await registerButton.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Required' }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request.post(`/api/public/events/${event.id}/register`, {
      data: {},
    });
    expect(response.status()).toBe(400);
  }

  await page.getByLabel('First Name').fill('Responsive');
  await page.getByLabel('Last Name').fill(`Registrant ${tenant.suffix}`);
  await page
    .getByLabel('Email')
    .fill(`responsive.${'long-address-segment.'.repeat(5)}${tenant.suffix}@test.invalid`);
  await page.getByLabel('Phone').fill('+60123450003');
  await registerButton.click();
  await expect(page.getByText('Too many registrations. Please try again later.')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const { error: rateLimitCleanupError } = await tenant.admin
    .from('public_rate_limits')
    .delete()
    .like('subject', `%:${event.id}`);
  if (rateLimitCleanupError) throw rateLimitCleanupError;

  await registerButton.click();
  await expect(registerButton).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', { name: 'Registration submitted' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByText('This event is fully booked')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const closedEvent = await tenant.createEvent({
    name: `Closed Responsive Event ${tenant.suffix}`,
    status: 'closed',
  });
  await page.goto(`/e/${closedEvent.slug}`);
  await expect(page.getByText('Registration is closed')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
