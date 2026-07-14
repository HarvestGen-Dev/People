// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ws from 'ws';
import net from 'node:net';

dotenv.config({ path: '.env.local', quiet: true });

const port = Number(process.env.REGISTRATION_TEST_PORT ?? 3108);
const baseUrl = `http://127.0.0.1:${port}`;
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch },
    realtime: { transport: ws },
  }
);

let server;
let churchId;
let otherChurchId;
let adminCookiesStr = '';
let otherAdminCookiesStr = '';
let testAdminUserId;
let testOtherAdminUserId;
let uploadedProofs = [];
let mockSmtpServer;
let sentEmailsCount = 0;
let smtpPort = 0;

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for the Next.js test server');
}

async function register(eventId, payload) {
  const response = await fetch(`${baseUrl}/api/public/events/${eventId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { response, body };
}

async function insertEvent(values) {
  const { data, error } = await admin
    .from('events')
    .insert({
      church_id: churchId,
      slug: `event-${crypto.randomBytes(4).toString('hex')}`,
      name: 'Test Event',
      start_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'published',
      ...values,
    })
    .select('id, church_id, price')
    .single();
  if (error) throw error;
  return data;
}

async function uploadProof(path) {
  const { error } = await admin.storage.from('payment-proofs').upload(path, Buffer.from('fake image'), { contentType: 'image/jpeg' });
  assert.ifError(error);
  uploadedProofs.push(path);
}

before(async () => {
  // Start Mock TCP SMTP Server for Nodemailer
  mockSmtpServer = net.createServer((socket) => {
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => {}); // Ignore errors

    let receivingData = false;
    let buffer = '';
    socket.write('220 mock ESMTP\r\n');
    
    socket.on('data', (data) => {
      buffer += data.toString();
      
      while (buffer.length > 0) {
        if (receivingData) {
          const endIdx = buffer.indexOf('\r\n.\r\n');
          if (endIdx !== -1) {
            receivingData = false;
            sentEmailsCount++;
            socket.write('250 OK\r\n');
            buffer = buffer.substring(endIdx + 5);
            continue;
          }
          break; // Wait for more data
        } else {
          const newlineIdx = buffer.indexOf('\n');
          if (newlineIdx === -1) break; // Wait for full line
          
          const line = buffer.substring(0, newlineIdx).trim().toUpperCase();
          buffer = buffer.substring(newlineIdx + 1);
          
          if (!line) continue;
          
          if (line.startsWith('EHLO') || line.startsWith('HELO')) {
            socket.write('250-mock\r\n250-AUTH LOGIN PLAIN\r\n250 OK\r\n');
          } else if (line.startsWith('AUTH')) {
            socket.write('235 OK\r\n');
          } else if (line.startsWith('MAIL')) {
            socket.write('250 OK\r\n');
          } else if (line.startsWith('RCPT')) {
            socket.write('250 OK\r\n');
          } else if (line.startsWith('DATA')) {
            receivingData = true;
            socket.write('354 Go ahead\r\n');
          } else if (line.startsWith('QUIT')) {
            socket.write('221 OK\r\n');
            socket.end();
          } else {
            socket.write('235 OK\r\n');
          }
        }
      }
    });
  });

  await new Promise((resolve) => {
    mockSmtpServer.listen(0, '127.0.0.1', () => {
      smtpPort = mockSmtpServer.address().port;
      resolve();
    });
  });

  const { data: church, error: churchError } = await admin
    .from('churches')
    .insert({
      slug: `reg-test-${suffix}`,
      name: `Reg Test ${suffix}`,
    })
    .select('id')
    .single();
  if (churchError) throw churchError;
  churchId = church.id;

  const { data: church2, error: churchError2 } = await admin
    .from('churches')
    .insert({
      slug: `reg-test-other-${suffix}`,
      name: `Reg Test Other ${suffix}`,
    })
    .select('id')
    .single();
  if (churchError2) throw churchError2;
  otherChurchId = church2.id;

  // Create admin user for church 1
  const email = `admin-${suffix}@test.com`;
  const password = 'Password123!';
  const { data: userAuth, error: authErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (authErr) throw authErr;
  testAdminUserId = userAuth.user.id;
  await admin.from('church_memberships').insert({ church_id: churchId, user_id: testAdminUserId, role: 'admin' });

  // Create admin user for church 2
  const otherEmail = `admin-other-${suffix}@test.com`;
  const { data: otherUserAuth, error: otherAuthErr } = await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true });
  if (otherAuthErr) throw otherAuthErr;
  testOtherAdminUserId = otherUserAuth.user.id;
  await admin.from('church_memberships').insert({ church_id: otherChurchId, user_id: testOtherAdminUserId, role: 'admin' });

  const getCookieStr = async (email, churchIdContext) => {
    const cookieStore = new Map();
    const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })); },
        setAll(cookies) { cookies.forEach(c => cookieStore.set(c.name, c.value)); }
      },
      global: { fetch: fetch },
      realtime: { transport: ws }
    });
    await authClient.auth.signInWithPassword({ email, password });
    cookieStore.set('people_church_id', churchIdContext);
    return Array.from(cookieStore.entries()).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
  };

  adminCookiesStr = await getCookieStr(email, churchId);
  otherAdminCookiesStr = await getCookieStr(otherEmail, otherChurchId);

  server = spawn(
    './node_modules/.bin/next',
    ['dev', '--hostname', '127.0.0.1', '--port', `${port}`],
    { 
      cwd: process.cwd(), 
      env: { 
        ...process.env, 
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: smtpPort.toString(),
        BREVO_SMTP_USER: 'mock-user',
        BREVO_SMTP_KEY: 'mock-key'
      }, 
      stdio: ['ignore', 'pipe', 'pipe'] 
    }
  );
  await waitForServer();
});

after(async () => {
  if (churchId) await admin.from('churches').delete().eq('id', churchId);
  if (otherChurchId) await admin.from('churches').delete().eq('id', otherChurchId);
  if (testAdminUserId) await admin.auth.admin.deleteUser(testAdminUserId);
  if (testOtherAdminUserId) await admin.auth.admin.deleteUser(testOtherAdminUserId);
  
  if (uploadedProofs.length > 0) {
    await admin.storage.from('payment-proofs').remove(uploadedProofs);
  }
  
  if (server && !server.killed) server.kill('SIGTERM');
  if (mockSmtpServer) mockSmtpServer.close();
});

test('Input Validation & Format constraints', async () => {
  const event = await insertEvent({ price: 0 });
  const basePayload = { first_name: 'A', last_name: 'B', email: 'a@b.com', phone: '123' };

  let res = await register(event.id, { ...basePayload, first_name: '   ' });
  assert.equal(res.response.status, 400);
  assert.match(res.body.error, /Missing or invalid required fields after trimming/);

  res = await register(event.id, { ...basePayload, payment_proof_url: { bad: 'object' } });
  assert.equal(res.response.status, 400);

  res = await register(event.id, { ...basePayload, email: 'not-an-email' });
  assert.equal(res.response.status, 400);
  
  res = await register(event.id, { ...basePayload, first_name: 'A'.repeat(200) });
  assert.equal(res.response.status, 400);
});

test('Reused proof is blocked (Proof ownership/uniqueness)', async () => {
  const event = await insertEvent({ price: 10 });
  const proofUrl = `${event.church_id}/${event.id}/reusable-proof.jpg`;
  await uploadProof(proofUrl);

  const basePayload = { first_name: 'A', last_name: 'B', email: 'a@b.com', phone: '123', guests: 1, payment_proof_url: proofUrl, paid_checkbox: true };
  let res = await register(event.id, basePayload);
  assert.equal(res.response.status, 200);

  res = await register(event.id, { ...basePayload, email: 'other@b.com' });
  assert.equal(res.response.status, 409);
  assert.match(res.body.error, /already been used/);
});

test('Closed and draft events', async () => {
  const draftEvent = await insertEvent({ price: 0, status: 'draft' });
  const closedEvent = await insertEvent({ price: 0, status: 'published', start_at: new Date(Date.now() - 86400000).toISOString() });

  const payload = { first_name: 'A', last_name: 'B', email: 'a@b.com', phone: '123', guests: 1 };
  
  let res = await register(draftEvent.id, payload);
  assert.equal(res.response.status, 404);

  res = await register(closedEvent.id, payload);
  assert.equal(res.response.status, 400);
  assert.match(res.body.error, /closed/);
});

test('Invalid status transitions', async () => {
  const event = await insertEvent({ price: 0 });
  const payload = { first_name: 'Idemp', last_name: 'Test', email: 'idemp@a.com', phone: '123', guests: 1 };
  const res = await register(event.id, payload);
  const regId = res.body.data.registration_id;

  const { error: rejectErr } = await admin.from('event_registrations').update({ status: 'rejected' }).eq('id', regId);
  assert.ok(rejectErr);
  assert.match(rejectErr.message, /invalid_status_transition/);
});

test('Graceful failure on identity conflict', async () => {
  const event = await insertEvent({ price: 50.0 });
  const proofUrl = `${event.church_id}/${event.id}/conflict.jpg`;
  await uploadProof(proofUrl);

  // A conflict requires email matching one person and phone matching another
  await admin.from('people').insert([
    { church_id: churchId, first_name: 'A', last_name: 'A', email: `a-${suffix}@test.com`, phone: '111-1111' },
    { church_id: churchId, first_name: 'B', last_name: 'B', email: `b-${suffix}@test.com`, phone: '222-2222' }
  ]);

  // Register with Person A's email but Person B's phone -> CONFLICT
  const payload = { first_name: 'New', last_name: 'User', email: `a-${suffix}@test.com`, phone: '222-2222', guests: 1, payment_proof_url: proofUrl, paid_checkbox: true };
  const res = await register(event.id, payload);
  const regId = res.body.data.registration_id;

  const approveRes = await fetch(`${baseUrl}/api/admin/registrations/${regId}/approve`, {
    method: 'POST',
    headers: { Cookie: adminCookiesStr }
  });
  
  assert.equal(approveRes.status, 400);
  const body = await approveRes.json();
  assert.match(body.error, /Identity conflict/);

  // Validate nothing mutated
  const { data: reg } = await admin.from('event_registrations').select('*').eq('id', regId).single();
  assert.equal(reg.status, 'pending_review');
  assert.equal(reg.person_id, null);
});

test('Transactional rollback via explicit RPC constraint failure', async () => {
  const event = await insertEvent({ price: 50.0 });
  const proofUrl = `${event.church_id}/${event.id}/rollback.jpg`;
  await uploadProof(proofUrl);

  const payload = { first_name: 'Rollback', last_name: 'Test', email: `rollback-${suffix}@a.com`, phone: '4444', guests: 1, payment_proof_url: proofUrl, paid_checkbox: true };
  const res = await register(event.id, payload);
  const regId = res.body.data.registration_id;

  // Force Postgres constraint failure by sending oversized string
  const oversizedReviewer = 'A'.repeat(300);
  const { error } = await admin.rpc('approve_event_registration', {
    p_church_id: churchId,
    p_registration_id: regId,
    p_reviewed_by: oversizedReviewer
  });
  
  assert.ok(error, 'RPC should have thrown due to column constraints');

  // Verify full rollback of side-effects
  const { data: rollbackPerson } = await admin.from('people').select('*').eq('church_id', churchId).eq('email', `rollback-${suffix}@a.com`);
  assert.equal(rollbackPerson.length, 0, 'Person should not have been created');
  
  const { data: eventsLog } = await admin.from('person_events').select('*').eq('church_id', churchId).contains('metadata', { event_id: event.id });
  assert.equal(eventsLog.length, 0, 'Person event should not have been logged');

  const { data: reg } = await admin.from('event_registrations').select('*').eq('id', regId).single();
  assert.equal(reg.status, 'pending_review', 'Registration should have rolled back to pending_review');
});

test('Cross-tenant registration ID tampering is blocked', async () => {
  const event = await insertEvent({ price: 50.0 });
  const proofUrl = `${event.church_id}/${event.id}/cross.jpg`;
  await uploadProof(proofUrl);

  const payload = { first_name: 'Cross', last_name: 'Tenant', email: 'cross@a.com', phone: '123', guests: 1, payment_proof_url: proofUrl, paid_checkbox: true };
  const res = await register(event.id, payload);
  const regId = res.body.data.registration_id;

  const pageRes = await fetch(`${baseUrl}/events/${event.id}/registrations`, {
    headers: { Cookie: otherAdminCookiesStr }
  });
  const pageBody = await pageRes.text();
  assert.doesNotMatch(pageBody, /cross@a\.com/);
  assert.doesNotMatch(pageBody, /Registration review/);

  // Approve using other admin context
  const approveRes = await fetch(`${baseUrl}/api/admin/registrations/${regId}/approve`, {
    method: 'POST',
    headers: { Cookie: otherAdminCookiesStr }
  });
  
  assert.equal(approveRes.status, 400);
  const body = await approveRes.json();
  assert.match(body.error, /Registration not found/);

  const rejectRes = await fetch(`${baseUrl}/api/admin/registrations/${regId}/reject`, {
    method: 'POST',
    headers: {
      Cookie: otherAdminCookiesStr,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason: 'Cross-tenant tamper attempt' })
  });
  assert.equal(rejectRes.status, 404);
  const rejectBody = await rejectRes.json();
  assert.match(rejectBody.error, /Registration not found/);

  const bulkApproveRes = await fetch(`${baseUrl}/api/admin/registrations/bulk-approve`, {
    method: 'POST',
    headers: {
      Cookie: otherAdminCookiesStr,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: [regId] })
  });
  assert.equal(bulkApproveRes.status, 200);
  const bulkBody = await bulkApproveRes.json();
  assert.deepEqual(bulkBody.data, { approved: 0, failed: 1 });

  const { data: reg } = await admin
    .from('event_registrations')
    .select('status, person_id, reviewed_by, reviewed_at, rejection_reason')
    .eq('id', regId)
    .single();
  assert.equal(reg.status, 'pending_review');
  assert.equal(reg.person_id, null);
  assert.equal(reg.reviewed_by, null);
  assert.equal(reg.reviewed_at, null);
  assert.equal(reg.rejection_reason, null);
});

test('Admin approval idempotency, outbox retry, and exact email counting', async () => {
  const event = await insertEvent({ price: 50.0 });
  const proofUrl = `${event.church_id}/${event.id}/idemp.jpg`;
  await uploadProof(proofUrl);

  const payload = { first_name: 'AdminApprove', last_name: 'Test', email: 'adminapp@a.com', phone: '123', guests: 1, payment_proof_url: proofUrl, paid_checkbox: true };
  const res = await register(event.id, payload);
  const regId = res.body.data.registration_id;

  const approveReq = async () => fetch(`${baseUrl}/api/admin/registrations/${regId}/approve`, {
    method: 'POST',
    headers: { Cookie: adminCookiesStr }
  });

  sentEmailsCount = 0; 
  
  const [approveRes1, approveRes2] = await Promise.all([approveReq(), approveReq()]);
  assert.equal(approveRes1.status, 200);
  assert.equal(approveRes2.status, 200);

  // Verify Exact-Once behavior due to locking outbox
  assert.equal(sentEmailsCount, 1, 'Exactly one email should have been sent concurrently');

  const { data: pEvents1 } = await admin.from('person_events').select('*').eq('church_id', churchId).contains('metadata', { event_id: event.id });
  assert.equal(pEvents1.length, 1);
  const { data: reg1 } = await admin.from('event_registrations').select('*').eq('id', regId).single();
  assert.equal(reg1.status, 'approved');
  assert.ok(reg1.confirmation_email_claimed_at);
  
  // Force a retry condition
  const past = new Date(Date.now() - 10 * 60000).toISOString();
  await admin.from('event_registrations').update({ confirmation_email_sent_at: null, confirmation_email_claimed_at: past }).eq('id', regId);

  const approveRes3 = await approveReq();
  assert.equal(approveRes3.status, 200);
  assert.equal(sentEmailsCount, 2, 'Email should retry exactly once more');
});
