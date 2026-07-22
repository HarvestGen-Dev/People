// <!-- AGENT: INTEGRATION -->
import { expect, test } from '@playwright/test';
import { loginThroughUi } from './helpers/auth';
import { expectNoServerComponentError, escapeRegExp } from './helpers/assertions';
import { E2ETenant, type TestUser } from './helpers/seed-tenant';
import { requireCount, requireQuery } from './helpers/supabase-admin';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64'
);

let tenant: E2ETenant;
let owner: TestUser;

test.beforeAll(async () => {
  tenant = await E2ETenant.create('Core Journeys');
  owner = await tenant.createUser('owner', 'journey-owner');
});

test.afterAll(async () => {
  await tenant.cleanup();
});

test('paid public registration can be approved and persists its person event', async ({ page }) => {
  const event = await tenant.createEvent({
    name: `Paid Registration ${tenant.suffix}`,
    price: 12.5,
    capacity: 3,
    payment_instructions: 'Use the synthetic E2E payment reference.',
  });
  const registrantEmail = `paid-registrant-${tenant.suffix}@test.invalid`;

  await page.goto(`/e/${event.slug}`);
  await expect(page.getByRole('heading', { name: event.name })).toBeVisible();
  await expect(page.getByText('3 left', { exact: true })).toBeVisible();

  await page.getByLabel('First Name').fill('Paid');
  await page.getByLabel('Last Name').fill(`Registrant ${tenant.suffix}`);
  await page.getByLabel('Email').fill(registrantEmail);
  await page.getByLabel('Phone').fill('+60123450001');
  await page.getByRole('button', { name: 'Continue to Payment' }).click();
  await page.getByLabel('Upload Payment Proof').setInputFiles({
    name: 'synthetic-proof.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  });
  await page.getByRole('checkbox', { name: 'I confirm I have made this payment' }).check();
  await page.getByRole('button', { name: 'Submit Registration' }).click();
  await expect(page.getByRole('heading', { name: 'Registration submitted' })).toBeVisible();

  const registration = await requireQuery(
    tenant.admin
      .from('event_registrations')
      .select('id, display_id, person_id, status, payment_proof_url')
      .eq('church_id', tenant.churchId)
      .eq('event_id', event.id)
      .eq('email', registrantEmail)
      .single(),
    'Unable to read browser-created registration'
  );
  expect(registration.status).toBe('pending_review');
  expect(registration.person_id).toBeNull();
  tenant.trackStorage('payment-proofs', registration.payment_proof_url);

  await loginThroughUi(page, owner, /\/dashboard$/);
  await page.goto(`/events/${event.display_id}/registrations?status=pending_review`);
  await expectNoServerComponentError(page);
  await expect(page.locator('tbody').getByText(registrantEmail, { exact: true })).toBeVisible();
  const approvalResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/registrations/${registration.id}/approve`) &&
      response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const approvalResponse = await approvalResponsePromise;
  expect(approvalResponse.status()).toBe(200);
  await expect(page.getByText('Approved — confirmation email sent')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /^Approved/ }).click();
  await expect(page).toHaveURL(/status=approved/);
  await expect(page.locator('tbody').getByText(registrantEmail, { exact: true })).toBeVisible();
  await expect(page.locator('tbody').getByText('Approved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('tbody').getByText('Approved', { exact: true })).toBeVisible();
  const approved = await requireQuery(
    tenant.admin
      .from('event_registrations')
      .select('person_id, status')
      .eq('id', registration.id)
      .single(),
    'Unable to verify approved registration'
  );
  expect(approved.status).toBe('approved');
  expect(approved.person_id).toBeTruthy();
  expect(
    await requireCount(
      tenant.admin
        .from('person_events')
        .select('id', { count: 'exact', head: true })
        .eq('church_id', tenant.churchId)
        .eq('person_id', approved.person_id)
        .eq('event_type', 'event_registered'),
      'Unable to count registration person events'
    )
  ).toBe(1);
});

test('public connect form creates idempotent tag and workflow side effects', async ({ page, request }) => {
  const tag = await tenant.createTag(`Connect Tag ${tenant.suffix}`);
  const workflow = await tenant.createWorkflow(`Connect Workflow ${tenant.suffix}`, ['Welcome']);
  const connectForm = await tenant.createConnectForm({
    title: `Connect Journey ${tenant.suffix}`,
    targetTagId: tag.id,
    targetWorkflowId: workflow.id,
  });
  const personEmail = `connect-person-${tenant.suffix}@test.invalid`;
  let capturedKey = '';
  let capturedBody: Record<string, unknown> | null = null;

  page.on('request', (browserRequest) => {
    if (browserRequest.url().includes(`/api/public/connect-forms/${connectForm.slug}/submit`)) {
      capturedKey = browserRequest.headers()['idempotency-key'] ?? '';
      capturedBody = browserRequest.postDataJSON() as Record<string, unknown>;
    }
  });

  await page.goto(`/connect/${connectForm.slug}`);
  await expect(page.getByRole('heading', { name: connectForm.title })).toBeVisible();
  await page.getByLabel('First name').fill('Connect');
  await page.getByLabel('Last name').fill(`Person ${tenant.suffix}`);
  await page.getByLabel('Email').fill(personEmail);
  await page.getByLabel('Phone').fill('+60123450002');
  await page.getByLabel('Campus').fill('Synthetic Connect Campus');
  await page.getByRole('button', { name: 'Submit details' }).click();
  await expect(page.getByRole('heading', { name: 'Thanks for connecting' })).toBeVisible();
  expect(capturedKey).not.toBe('');
  expect(capturedBody).not.toBeNull();

  const retry = await request.post(`/api/public/connect-forms/${connectForm.slug}/submit`, {
    headers: { 'Idempotency-Key': capturedKey },
    data: capturedBody,
  });
  expect(retry.status()).toBe(200);
  const retryResult = await retry.json();

  const person = await requireQuery(
    tenant.admin
      .from('people')
      .select('id, display_id, first_name, last_name, email')
      .eq('church_id', tenant.churchId)
      .eq('email', personEmail)
      .single(),
    'Unable to read connect-form person'
  );
  expect(retryResult.person_id).toBe(person.id);
  expect(
    await requireCount(
      tenant.admin
        .from('person_tags')
        .select('person_id', { count: 'exact', head: true })
        .eq('church_id', tenant.churchId)
        .eq('person_id', person.id)
        .eq('tag_id', tag.id),
      'Unable to count connect-form tags'
    )
  ).toBe(1);
  expect(
    await requireCount(
      tenant.admin
        .from('workflow_cards')
        .select('id', { count: 'exact', head: true })
        .eq('church_id', tenant.churchId)
        .eq('person_id', person.id)
        .eq('workflow_id', workflow.id),
      'Unable to count connect-form cards'
    )
  ).toBe(1);

  await loginThroughUi(page, owner, /\/dashboard$/);
  await page.goto(`/people?search=${encodeURIComponent(personEmail)}`);
  await expect(page.locator('tbody').getByText(`${person.first_name} ${person.last_name}`, { exact: true })).toBeVisible();
  await expect(page.locator('tbody').getByText(tag.name, { exact: true })).toBeVisible();
  await page.goto(`/workflows/${workflow.display_id}`);
  await expectNoServerComponentError(page);
  await expect(
    page.getByRole('button', {
      name: new RegExp(`${escapeRegExp(person.first_name)} ${escapeRegExp(person.last_name)}`),
    })
  ).toBeVisible();

  const { error: deactivateError } = await tenant.admin
    .from('connect_forms')
    .update({ is_active: false })
    .eq('id', connectForm.id)
    .eq('church_id', tenant.churchId);
  if (deactivateError) throw new Error(`Unable to deactivate connect form: ${deactivateError.message}`);

  await page.goto(`/connect/${connectForm.slug}`);
  await expect(page.getByRole('heading', { name: connectForm.title })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  const inactiveSubmission = await request.post(
    `/api/public/connect-forms/${connectForm.slug}/submit`,
    {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      data: capturedBody,
    }
  );
  expect(inactiveSubmission.status()).toBe(404);
  expect(await inactiveSubmission.text()).not.toMatch(/constraint|postgres|supabase/i);
});

test('owner creates, edits, moves, and completes a person workflow card', async ({ page }) => {
  const workflow = await tenant.createWorkflow(`People Workflow ${tenant.suffix}`, [
    'New',
    'Followed up',
  ]);
  const firstName = 'Journey';
  const lastName = `Person ${tenant.suffix}`;
  const personEmail = `journey-person-${tenant.suffix}@test.invalid`;

  await loginThroughUi(page, owner, /\/dashboard$/);
  await page.goto('/people');
  await page.getByRole('link', { name: 'Add person' }).first().click();
  await page.getByRole('button', { name: 'Create Person' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'First name is required' })).toBeVisible();
  await page.getByLabel('First Name').fill(firstName);
  await page.getByLabel('Last Name').fill(lastName);
  await page.getByLabel('Email').fill(personEmail);
  await page.getByRole('button', { name: 'Create Person' }).click();
  await expect(page.getByRole('heading', { name: `${firstName} ${lastName}` })).toBeVisible();

  await page.getByRole('link', { name: 'Edit person' }).click();
  await page.getByLabel('Campus').fill('Updated Synthetic Campus');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Updated Synthetic Campus', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Updated Synthetic Campus', { exact: true }).first()).toBeVisible();

  await page.goto(`/workflows/${workflow.display_id}`);
  const addPersonTrigger = page.getByRole('button', { name: 'Add person', exact: true }).first();
  await addPersonTrigger.click();
  const addDialog = page.getByRole('dialog', { name: 'Add person to workflow' });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByPlaceholder('Search by name or email')).toBeFocused();
  await addDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(addPersonTrigger).toBeFocused();
  await addPersonTrigger.click();
  await addDialog.getByPlaceholder('Search by name or email').fill(personEmail);
  await addDialog.getByRole('button', { name: new RegExp(escapeRegExp(personEmail)) }).click();
  await addDialog.getByRole('button', { name: 'Add to workflow' }).click();
  await expect(page.getByText('Person added to workflow')).toBeVisible();

  const personCard = page.getByRole('button', {
    name: new RegExp(`${escapeRegExp(firstName)} ${escapeRegExp(lastName)}`),
  });
  await expect(personCard).toBeVisible();
  await personCard.click();
  const cardDialog = page.getByRole('dialog', { name: 'Card details' });
  await cardDialog.getByLabel('Current step').click();
  await page.getByRole('option', { name: 'Followed up' }).click();
  await cardDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Card updated')).toBeVisible();
  await cardDialog.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  const followedUpColumn = page.getByRole('region', { name: /Followed up/ });
  await expect(followedUpColumn.getByText(`${firstName} ${lastName}`, { exact: true })).toBeVisible();
  await followedUpColumn.getByRole('button', { name: new RegExp(escapeRegExp(firstName)) }).click();
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page.getByText('Marked as complete')).toBeVisible();

  await page.reload();
  const completedColumn = page.getByRole('region', { name: /Completed/ });
  await expect(completedColumn.getByText(`${firstName} ${lastName}`, { exact: true })).toBeVisible();
});
