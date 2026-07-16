// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import {
  startNextDevServer,
  waitForNextDevServer,
} from './next-test-server.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.PEOPLE_PHOTO_TEST_PORT ?? 3114);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const password = 'Password123!';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch },
    realtime: { transport: ws },
  }
);

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch },
    realtime: { transport: ws },
  }
);

let server;
let churchId;
let otherChurchId;
let personId;
let otherPersonId;
let portalPersonId;
let adminCookies = '';
let viewerCookies = '';
let memberCookies = '';
let portalCookies = '';
const userIds = [];

async function sessionCookie(email, selectedChurchId = churchId) {
  const cookieStore = new Map();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
        },
        setAll(cookies) {
          cookies.forEach((cookie) => cookieStore.set(cookie.name, cookie.value));
        },
      },
      global: { fetch: fetch },
      realtime: { transport: ws },
    }
  );
  await authClient.auth.signInWithPassword({ email, password });
  if (selectedChurchId) cookieStore.set('people_church_id', selectedChurchId);
  return Array.from(cookieStore.entries())
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
}

async function imageFile(format = 'jpeg', options = {}) {
  const width = options.width ?? 32;
  const height = options.height ?? 32;
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 22, g: 120, b: 90 },
    },
  });

  if (format === 'png') pipeline = pipeline.png();
  else if (format === 'webp') pipeline = pipeline.webp();
  else pipeline = pipeline.jpeg({ exif: { IFD0: { Copyright: 'private' } } });

  const buffer = await pipeline.toBuffer();
  const type = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
  return new File([buffer], `photo.${format === 'jpeg' ? 'jpg' : format}`, { type });
}

async function uploadPhoto(cookie, id, file, extraFields = {}) {
  const form = new FormData();
  form.set('file', file);
  Object.entries(extraFields).forEach(([key, value]) => form.set(key, value));
  const response = await fetch(`${baseUrl}/api/admin/people/${id}/photo`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });
  const body = await response.json();
  return { response, body };
}

async function getPhoto(cookie, id) {
  const response = await fetch(`${baseUrl}/api/admin/people/${id}/photo`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  const body = await response.json();
  return { response, body };
}

before(async () => {
  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({ slug: `photos-${suffix}`, name: `Photos ${suffix}` })
    .select('id')
    .single();
  if (churchError) throw churchError;
  churchId = church.id;

  const { data: otherChurch, error: otherChurchError } = await admin
    .from('churches')
    .insert({ slug: `photos-other-${suffix}`, name: `Photos Other ${suffix}` })
    .select('id')
    .single();
  if (otherChurchError) throw otherChurchError;
  otherChurchId = otherChurch.id;

  const { data: people, error: peopleError } = await admin
    .from('people')
    .insert([
      { church_id: churchId, first_name: 'Photo', last_name: 'Person', email: `photo-${suffix}@test.com`, status: 'visitor' },
      { church_id: otherChurchId, first_name: 'Other', last_name: 'Tenant', email: `other-photo-${suffix}@test.com`, status: 'visitor' },
      { church_id: churchId, first_name: 'Portal', last_name: 'Owner', email: `portal-photo-${suffix}@test.com`, status: 'child' },
    ])
    .select('id, church_id');
  if (peopleError) throw peopleError;
  personId = people[0].id;
  otherPersonId = people[1].id;
  portalPersonId = people[2].id;

  for (const role of ['admin', 'viewer', 'member']) {
    const email = `${role}-photo-${suffix}@test.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const { error: membershipError } = await admin
      .from('church_memberships')
      .insert({ church_id: churchId, user_id: data.user.id, role });
    if (membershipError) throw membershipError;
    const cookie = await sessionCookie(email);
    if (role === 'admin') adminCookies = cookie;
    if (role === 'viewer') viewerCookies = cookie;
    if (role === 'member') memberCookies = cookie;
  }

  const portalEmail = `portal-only-photo-${suffix}@test.com`;
  const { data: portalAuth, error: portalAuthError } = await admin.auth.admin.createUser({
    email: portalEmail,
    password,
    email_confirm: true,
  });
  if (portalAuthError) throw portalAuthError;
  userIds.push(portalAuth.user.id);
  const { error: linkError } = await admin
    .from('person_user_links')
    .insert({
      church_id: churchId,
      person_id: portalPersonId,
      user_id: portalAuth.user.id,
      claim_method: 'verified_email',
    });
  if (linkError) throw linkError;
  portalCookies = await sessionCookie(portalEmail, null);

  server = startNextDevServer({ port });
  await waitForNextDevServer({ server, baseUrl });
});

after(async () => {
  if (churchId) await admin.from('churches').delete().eq('id', churchId);
  if (otherChurchId) await admin.from('churches').delete().eq('id', otherChurchId);
  await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  if (server?.process && !server.process.killed) server.process.kill('SIGTERM');
});

test('people-photos bucket is private and direct client storage writes are denied', async () => {
  const { data: bucket, error: bucketError } = await admin.storage.getBucket('people-photos');
  assert.equal(bucketError, null);
  assert.equal(bucket.public, false);
  assert.deepEqual(bucket.allowed_mime_types, ['image/webp']);

  const { error: uploadError } = await anon.storage
    .from('people-photos')
    .upload(`${churchId}/${personId}/client.webp`, new Blob(['x'], { type: 'image/webp' }));
  assert.ok(uploadError);
});

test('admin uploads are processed to private paths and signed URLs are short lived', async () => {
  const result = await uploadPhoto(adminCookies, personId, await imageFile('jpeg'), {
    path: `${otherChurchId}/${otherPersonId}/evil.webp`,
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.expiresIn, 600);
  assert.match(result.body.data.signedUrl, /\/storage\/v1\/object\/sign\/people-photos\//);
  assert.equal(result.body.data.photo_path.startsWith(`${churchId}/${personId}/`), true);
  assert.equal(result.body.data.photo_path.includes('evil'), false);

  const { data: person } = await admin
    .from('people')
    .select('photo_path, photo_url')
    .eq('id', personId)
    .single();
  assert.equal(person.photo_path, result.body.data.photo_path);
  assert.equal(person.photo_url, null);

  const downloaded = await admin.storage.from('people-photos').download(person.photo_path);
  assert.equal(downloaded.error, null);
  assert.equal(downloaded.data.type, 'image/webp');
});

test('upload rejects spoofed MIME, excessive dimensions, unauthorized role, and cross-tenant people', async () => {
  const spoofed = new File([Buffer.from('not an image')], 'spoof.jpg', { type: 'image/jpeg' });
  const spoofedResult = await uploadPhoto(adminCookies, personId, spoofed);
  assert.equal(spoofedResult.response.status, 400);

  const oversizedResult = await uploadPhoto(adminCookies, personId, await imageFile('png', { width: 4097, height: 8 }));
  assert.equal(oversizedResult.response.status, 413);

  const viewerResult = await uploadPhoto(viewerCookies, personId, await imageFile('webp'));
  assert.equal(viewerResult.response.status, 403);

  const crossTenant = await uploadPhoto(adminCookies, otherPersonId, await imageFile('webp'));
  assert.equal(crossTenant.response.status, 404);
});

test('failed replacement preserves previous private photo and successful replacement removes old object', async () => {
  const { data: before } = await admin
    .from('people')
    .select('photo_path')
    .eq('id', personId)
    .single();

  const invalid = new File([Buffer.from('bad')], 'bad.png', { type: 'image/png' });
  const failed = await uploadPhoto(adminCookies, personId, invalid);
  assert.equal(failed.response.status, 400);

  const { data: afterFailed } = await admin
    .from('people')
    .select('photo_path')
    .eq('id', personId)
    .single();
  assert.equal(afterFailed.photo_path, before.photo_path);

  const replacement = await uploadPhoto(adminCookies, personId, await imageFile('webp'));
  assert.equal(replacement.response.status, 200);
  assert.notEqual(replacement.body.data.photo_path, before.photo_path);

  const oldDownload = await admin.storage.from('people-photos').download(before.photo_path);
  assert.ok(oldDownload.error);
});

test('photo retrieval is authorized for tenant readers but not anonymous or legacy member', async () => {
  const anonymous = await getPhoto('', personId);
  assert.equal(anonymous.response.status, 401);

  const member = await getPhoto(memberCookies, personId);
  assert.equal(member.response.status, 403);

  const viewer = await getPhoto(viewerCookies, personId);
  assert.equal(viewer.response.status, 200);
  assert.ok(viewer.body.data.signedUrl);

  const crossTenant = await getPhoto(adminCookies, otherPersonId);
  assert.equal(crossTenant.response.status, 404);
});

test('portal user can retrieve own child photo but not another person photo', async () => {
  await uploadPhoto(adminCookies, portalPersonId, await imageFile('jpeg'));

  const own = await fetch(`${baseUrl}/api/portal/people/${portalPersonId}/photo`, {
    headers: { Cookie: portalCookies },
  });
  const ownBody = await own.json();
  assert.equal(own.status, 200);
  assert.ok(ownBody.data.signedUrl);

  const other = await fetch(`${baseUrl}/api/portal/people/${personId}/photo`, {
    headers: { Cookie: portalCookies },
  });
  assert.equal(other.status, 404);
});

test('admin can remove a photo and storage cleanup is tenant-scoped', async () => {
  const { data: before } = await admin
    .from('people')
    .select('photo_path')
    .eq('id', personId)
    .single();
  assert.ok(before.photo_path);

  const response = await fetch(`${baseUrl}/api/admin/people/${personId}/photo`, {
    method: 'DELETE',
    headers: { Cookie: adminCookies },
  });
  assert.equal(response.status, 200);

  const { data: afterRemove } = await admin
    .from('people')
    .select('photo_path, photo_url')
    .eq('id', personId)
    .single();
  assert.equal(afterRemove.photo_path, null);
  assert.equal(afterRemove.photo_url, null);

  const removedDownload = await admin.storage.from('people-photos').download(before.photo_path);
  assert.ok(removedDownload.error);
});
