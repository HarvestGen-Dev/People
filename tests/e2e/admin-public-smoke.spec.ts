// <!-- AGENT: INTEGRATION -->
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';
const adminEmail = `e2e-admin-${suffix}@test.com`;
const registrantEmail = `e2e-registrant-${suffix}@test.com`;
const eventSlug = `e2e-event-${suffix}`;

const pngProof = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

let admin: SupabaseClient;
let churchId: string;
let eventId: string;
let adminUserId: string;
let uploadedProofs: string[] = [];

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial('admin and public registration smoke', () => {
  test.beforeAll(async () => {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch },
      }
    );

    const { data: church, error: churchError } = await admin
      .from('churches')
      .insert({
        slug: `e2e-${suffix}`,
        name: `E2E Church ${suffix}`,
      })
      .select('id')
      .single();
    expect(churchError).toBeNull();
    assert.ok(church);
    churchId = church.id;

    const { data: userAuth, error: userError } =
      await admin.auth.admin.createUser({
        email: adminEmail,
        password,
        email_confirm: true,
      });
    expect(userError).toBeNull();
    assert.ok(userAuth.user);
    adminUserId = userAuth.user.id;

    const { error: membershipError } = await admin
      .from('church_memberships')
      .insert({
        church_id: churchId,
        user_id: adminUserId,
        role: 'admin',
      });
    expect(membershipError).toBeNull();

    const { data: event, error: eventError } = await admin
      .from('events')
      .insert({
        church_id: churchId,
        slug: eventSlug,
        name: `E2E Paid Event ${suffix}`,
        description: 'Browser smoke event',
        location: 'Main Hall',
        start_at: new Date(Date.now() + 86_400_000).toISOString(),
        capacity: 25,
        price: 25,
        currency: 'MYR',
        payment_link: 'https://example.com/pay',
        payment_instructions: 'Pay before submitting proof.',
        status: 'published',
      })
      .select('id')
      .single();
    expect(eventError).toBeNull();
    assert.ok(event);
    eventId = event.id;
  });

  test.afterAll(async () => {
    if (eventId) {
      const { data: registrations } = await admin
        .from('event_registrations')
        .select('payment_proof_url')
        .eq('event_id', eventId);
      uploadedProofs = (registrations || [])
        .map((registration) => registration.payment_proof_url)
        .filter(Boolean) as string[];
    }

    if (uploadedProofs.length > 0) {
      await admin.storage.from('payment-proofs').remove(uploadedProofs);
    }

    if (churchId) {
      await admin.from('churches').delete().eq('id', churchId);
    }

    if (adminUserId) {
      await admin.auth.admin.deleteUser(adminUserId);
    }
  });

  test('admin can sign in and open core workspace pages', async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole('heading', { name: 'Ministry overview' })
    ).toBeVisible();

    await page.getByRole('link', { name: 'People', exact: true }).click();
    await expect(page).toHaveURL(/\/people$/);
    await expect(
      page.getByRole('heading', { name: 'People', exact: true })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(
      page.getByRole('heading', { name: 'Events', exact: true })
    ).toBeVisible();
  });

  test('public paid registration can be submitted and rejected by admin', async ({
    page,
  }) => {
    await page.goto(`/e/${eventSlug}`);
    await expect(
      page.getByRole('heading', { name: `E2E Paid Event ${suffix}` })
    ).toBeVisible();

    await page.locator('input[name="first_name"]').fill('Jordan');
    await page.locator('input[name="last_name"]').fill('Tan');
    await page.locator('input[name="email"]').fill(registrantEmail);
    await page.locator('input[name="phone"]').fill('0123456789');
    await page.locator('input[name="guests"]').fill('1');
    await page.getByRole('button', { name: 'Continue to Payment' }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: pngProof,
    });
    await page.getByText('I confirm I have made this payment').click();
    await page.getByRole('button', { name: 'Submit Registration' }).click();

    await expect(
      page.getByRole('heading', { name: 'Registration submitted' })
    ).toBeVisible();
    await expect(page.getByText(/Ref: REG-/)).toBeVisible();

    const { data: registration, error: registrationError } = await admin
      .from('event_registrations')
      .select('id, status, payment_proof_url')
      .eq('event_id', eventId)
      .eq('email', registrantEmail)
      .single();
    expect(registrationError).toBeNull();
    assert.ok(registration);
    expect(registration.status).toBe('pending_review');
    expect(registration.payment_proof_url).toBeTruthy();

    await login(page);
    await page.goto(`/events/${eventId}/registrations`);
    await expect(
      page.getByRole('heading', { name: 'Registration review' })
    ).toBeVisible();
    await expect(page.getByRole('table').getByText(registrantEmail)).toBeVisible();

    await page
      .getByRole('row', { name: new RegExp(registrantEmail) })
      .getByRole('button', { name: 'Reject' })
      .click();
    await page
      .getByPlaceholder('e.g. Payment amount could not be verified')
      .fill('E2E smoke rejection');
    await page.getByRole('button', { name: 'Reject registration' }).click();
    await expect(page.getByText('Registration rejected')).toBeVisible();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from('event_registrations')
          .select('status, rejection_reason')
          .eq('id', registration.id)
          .single();
        return data;
      })
      .toMatchObject({
        status: 'rejected',
        rejection_reason: 'E2E smoke rejection',
      });
  });
});
