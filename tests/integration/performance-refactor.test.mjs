// <!-- AGENT: BACKEND -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  isTenantScopedPeoplePhotoPath,
} from '../../src/lib/people/photo-processing.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:56321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let churchId;
let tagId;
let personIds = [];

before(async () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const { data: church, error: cErr } = await admin
    .from('churches')
    .insert({
      slug: `perf-test-${suffix}`,
      name: `Perf Test Church ${suffix}`,
    })
    .select('id')
    .single();
  if (cErr) throw cErr;
  churchId = church.id;

  const { data: tag, error: tErr } = await admin
    .from('tags')
    .insert({
      church_id: churchId,
      name: `VIP Guest ${suffix}`,
      color: '#3B82F6',
    })
    .select('id')
    .single();
  if (tErr) throw tErr;
  tagId = tag.id;

  // Insert test people with valid UUIDs and photo paths
  const p1 = crypto.randomUUID();
  const p2 = crypto.randomUUID();
  const p3 = crypto.randomUUID();
  personIds = [p1, p2, p3];

  const peopleData = [
    {
      id: p1,
      church_id: churchId,
      first_name: 'Jonathan',
      last_name: 'Tan',
      email: `jonathan.tan.${suffix}@example.my`,
      phone: '+60129990001',
      status: 'active',
      photo_path: `${churchId}/${p1}/${crypto.randomUUID()}.webp`,
    },
    {
      id: p2,
      church_id: churchId,
      first_name: 'Grace',
      last_name: 'Lim',
      email: `grace.lim.${suffix}@example.my`,
      phone: '+60129990002',
      status: 'visitor',
      photo_path: `${churchId}/${p2}/${crypto.randomUUID()}.webp`,
    },
    {
      id: p3,
      church_id: churchId,
      first_name: 'Joshua',
      last_name: 'Lee',
      email: `joshua.lee.${suffix}@example.my`,
      phone: '+60129990003',
      status: 'active',
    },
  ];

  const { error: pErr } = await admin
    .from('people')
    .insert(peopleData);
  if (pErr) throw pErr;

  // Assign tag to Jonathan Tan
  await admin.from('person_tags').insert({
    church_id: churchId,
    person_id: personIds[0],
    tag_id: tagId,
  });
});

after(async () => {
  if (churchId) {
    await admin.from('churches').delete().eq('id', churchId);
  }
});

test('get_people_directory RPC filters correctly by church, search, status, and tag', async () => {
  // 1. All people in tenant
  const { data: allRes } = await admin.rpc('get_people_directory', {
    p_church_id: churchId,
    p_page: 1,
    p_page_size: 50,
  });
  assert.equal(allRes.length, 3);
  assert.equal(Number(allRes[0].total_count), 3);

  // 2. Search by substring name
  const { data: searchRes } = await admin.rpc('get_people_directory', {
    p_church_id: churchId,
    p_search: 'Tan',
    p_page: 1,
    p_page_size: 50,
  });
  assert.equal(searchRes.length, 1);
  assert.equal(searchRes[0].first_name, 'Jonathan');
  assert.equal(Number(searchRes[0].total_count), 1);

  // 3. Search by phone number
  const { data: phoneRes } = await admin.rpc('get_people_directory', {
    p_church_id: churchId,
    p_search: '9990002',
    p_page: 1,
    p_page_size: 50,
  });
  assert.equal(phoneRes.length, 1);
  assert.equal(phoneRes[0].first_name, 'Grace');

  // 4. Filter by status
  const { data: statusRes } = await admin.rpc('get_people_directory', {
    p_church_id: churchId,
    p_status: 'visitor',
    p_page: 1,
    p_page_size: 50,
  });
  assert.equal(statusRes.length, 1);
  assert.equal(statusRes[0].first_name, 'Grace');

  // 5. Filter by tag
  const { data: tagRes } = await admin.rpc('get_people_directory', {
    p_church_id: churchId,
    p_tag_id: tagId,
    p_page: 1,
    p_page_size: 50,
  });
  assert.equal(tagRes.length, 1);
  assert.equal(tagRes[0].first_name, 'Jonathan');
  assert.equal(Array.isArray(tagRes[0].person_tags), true);
  assert.equal(tagRes[0].person_tags.length, 1);
  assert.equal(tagRes[0].person_tags[0].tag.id, tagId);
});

test('batch photo signing creates signed URLs via Supabase Storage API', async () => {
  const path = `${churchId}/${personIds[0]}/${crypto.randomUUID()}.webp`;
  await admin.storage.from('people-photos').upload(path, Buffer.from('test-image-content'), {
    contentType: 'image/webp',
  });

  const { data, error } = await admin.storage
    .from('people-photos')
    .createSignedUrls([path], 600);

  assert.equal(error, null);
  assert.equal(Array.isArray(data), true);
  assert.equal(data.length, 1);
  assert.equal(typeof data[0].signedUrl, 'string');
  assert.match(data[0].signedUrl, /token=/);
});

test('photo path helpers enforce strict tenant scoping without loading sharp', () => {
  const validPath = `${churchId}/11111111-1111-4111-8111-111111111111/avatar.webp`;
  const crossTenantPath = `other-church/11111111-1111-4111-8111-111111111111/avatar.webp`;
  const traversalPath = `${churchId}/../../etc/passwd`;

  assert.equal(
    isTenantScopedPeoplePhotoPath(validPath, churchId, '11111111-1111-4111-8111-111111111111'),
    true
  );
  assert.equal(
    isTenantScopedPeoplePhotoPath(crossTenantPath, churchId, '11111111-1111-4111-8111-111111111111'),
    false
  );
  assert.equal(
    isTenantScopedPeoplePhotoPath(traversalPath, churchId, '11111111-1111-4111-8111-111111111111'),
    false
  );
});
