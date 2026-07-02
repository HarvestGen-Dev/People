// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationPath =
  'supabase/migrations/014_platform_admins_and_profile_claims.sql';
const invitedProfileMigrationPath =
  'supabase/migrations/016_create_invited_person_profile.sql';

test('onboarding migration keeps portal identity separate from tenant roles', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /CREATE TABLE person_user_links/);
  assert.match(sql, /CREATE TABLE person_claim_requests/);
  assert.match(sql, /CREATE TABLE platform_admins/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION claim_person_profile\(\)/);
  assert.doesNotMatch(
    sql.match(/CREATE OR REPLACE FUNCTION claim_person_profile\(\)[\s\S]*?REVOKE ALL/)?.[0] || '',
    /INSERT INTO public\.church_memberships/
  );
});

test('profile claim requires a confirmed auth email and locks the person row', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  const claimFunction =
    sql.match(/CREATE OR REPLACE FUNCTION claim_person_profile\(\)[\s\S]*?REVOKE ALL/)?.[0] || '';

  assert.match(claimFunction, /email_confirmed_at IS NOT NULL/);
  assert.match(claimFunction, /FOR UPDATE/);
  assert.match(claimFunction, /auth\.uid\(\)/);
});

test('invitation acceptance rejects revoked tokens and supports owners', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /CHECK \(role IN \('owner', 'admin', 'member'\)\)/);
  assert.match(sql, /invitation\.revoked_at IS NULL/);
  assert.match(sql, /church_memberships_retain_owner/);
});

test('invited users can atomically create and link their own profile', async () => {
  const sql = await readFile(invitedProfileMigrationPath, 'utf8');
  const createFunction =
    sql.match(
      /CREATE OR REPLACE FUNCTION public\.create_invited_person_profile\([\s\S]*?REVOKE ALL/
    )?.[0] || '';

  assert.match(sql, /'invitation'/);
  assert.match(createFunction, /invitation\.token_hash = p_token_hash/);
  assert.match(createFunction, /invitation\.revoked_at IS NULL/);
  assert.match(createFunction, /INSERT INTO public\.people/);
  assert.match(createFunction, /INSERT INTO public\.person_user_links/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.create_invited_person_profile\([\s\S]*?TO service_role/
  );
  assert.doesNotMatch(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.create_invited_person_profile\([\s\S]*?TO authenticated/
  );
});
