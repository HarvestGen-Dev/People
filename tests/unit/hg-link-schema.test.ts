// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentSchema, defaultHgLinkContent } from '../../src/lib/hg-link/contentSchema.ts';
import { normalizeSafeExternalUrl } from '../../src/lib/hg-link/safeUrl.ts';
import {
  defaultFormSeeds,
  formDefinitionSchema,
  validateSubmission,
} from '../../src/lib/hg-link/formSchema.ts';

test('default content keeps the seven original cards', () => {
  const parsed = contentSchema.parse(defaultHgLinkContent());
  assert.deepEqual(
    parsed.cards.map((c) => c.title),
    ['Drip & Brew', 'I’m New To Church!', 'I Just Became A Christian', 'I Want To Be Water Baptised', 'I Want To Serve', 'Kids Gen', 'More on HarvestGen']
  );
});

test('unsafe external URLs are rejected', () => {
  for (const url of [
    'javascript:alert(1)', 'http://example.com', 'https://localhost/x', 'https://127.0.0.1/',
    'https://10.0.0.5/', 'https://192.168.1.1/', 'https://user:pw@example.com/', 'https://intranet/', 'data:text/html,x',
  ]) {
    assert.equal(normalizeSafeExternalUrl(url), null, url);
  }
  assert.equal(normalizeSafeExternalUrl('https://dripnbrew.harvestgen.org/'), 'https://dripnbrew.harvestgen.org/');
});

test('content schema rejects unknown keys, bad URLs, and duplicate card ids', () => {
  const base = defaultHgLinkContent();
  assert.equal(contentSchema.safeParse({ ...base, html: '<script>' }).success, false);
  const badUrl = structuredClone(base);
  badUrl.cards[4].destination = { type: 'external', url: 'javascript:alert(1)' };
  assert.equal(contentSchema.safeParse(badUrl).success, false);
  const dup = structuredClone(base);
  dup.cards[1].id = dup.cards[0].id;
  assert.equal(contentSchema.safeParse(dup).success, false);
});

test('all default form definitions are valid', () => {
  for (const seed of defaultFormSeeds()) {
    const result = formDefinitionSchema.safeParse(seed.definition);
    assert.equal(result.success, true, seed.slug);
  }
});

test('invalid definitions are rejected', () => {
  const [seed] = defaultFormSeeds();
  const mutate = (fn: (d: typeof seed.definition) => void) => {
    const d = structuredClone(seed.definition);
    fn(d);
    return formDefinitionSchema.safeParse(d).success;
  };
  assert.equal(mutate((d) => { d.fields = d.fields.filter((x) => x.id !== 'first_name'); }), false);
  assert.equal(mutate((d) => { d.fields.find((x) => x.id === 'email')!.type = 'text'; }), false);
  assert.equal(mutate((d) => { d.fields.push({ ...d.fields[0] }); }), false);
  assert.equal(mutate((d) => { d.fields.find((x) => x.id === 'email')!.hidden = true; d.fields.find((x) => x.id === 'phone')!.hidden = true; }), false);
  assert.equal(mutate((d) => { d.fields.push({ id: 'pick', type: 'dropdown', label: 'Pick', helpText: '', required: false, hidden: false, options: [], optionsSource: 'inline' }); }), false);
});

test('new to church: both questions are independent and optional', () => {
  const seed = defaultFormSeeds().find((s) => s.slug === 'new-to-church')!;
  const base = { first_name: 'A', last_name: 'B', email: 'a@example.com', phone: '012 345 6789' };
  assert.equal(validateSubmission(seed.definition, {}, base).ok, true);
  const onlyOne = validateSubmission(seed.definition, {}, { ...base, looking_for_church: 'yes', interested_in_jesus: 'no' });
  assert.equal(onlyOne.ok, true);
  const none = validateSubmission(seed.definition, {}, { ...base, looking_for_church: 'no', interested_in_jesus: 'no' });
  assert.equal(none.ok, true);
});

test('submission validation drops unknown and hidden fields and keeps core fields separate', () => {
  const seed = defaultFormSeeds().find((s) => s.slug === 'serve')!;
  const definition = structuredClone(seed.definition);
  definition.fields.find((f) => f.id === 'served_before')!.hidden = true;
  const result = validateSubmission(definition, {}, {
    first_name: ' Jo ', last_name: 'Lee', email: 'JO@Example.com', phone: '+60 12-345 6789',
    served_before: 'yes', preferred_ministry: 'worship', availability: ['sunday_mornings'],
    follow_up_consent: true, is_admin: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.core.first_name, 'Jo');
  assert.equal(result.data.core.email, 'jo@example.com');
  assert.deepEqual(Object.keys(result.data.answers).sort(), ['availability', 'follow_up_consent', 'preferred_ministry']);
});

test('submission validation enforces required, options and consent', () => {
  const seed = defaultFormSeeds().find((s) => s.slug === 'became-a-christian')!;
  const result = validateSubmission(seed.definition, {}, {
    first_name: 'A', last_name: 'B', email: 'bad', contact_method: 'carrier-pigeon', follow_up_consent: false,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(Object.keys(result.errors).sort(), ['contact_method', 'email', 'follow_up_consent']);
});

test('list-sourced dropdowns only accept resolved options', () => {
  const seed = defaultFormSeeds().find((s) => s.slug === 'water-baptism')!;
  const values = {
    first_name: 'A', last_name: 'B', email: 'a@example.com', gender: 'female', birthdate: '1990-01-02',
    marital_status: 'single', baptised_before: 'no', follow_up_consent: true,
  };
  const resolved = { connect_group: [{ value: 'abc', label: 'Group A' }] };
  assert.equal(validateSubmission(seed.definition, resolved, { ...values, connect_group: 'abc' }).ok, true);
  assert.equal(validateSubmission(seed.definition, resolved, { ...values, connect_group: 'zzz' }).ok, false);
  assert.equal(validateSubmission(seed.definition, resolved, values).ok, true);
});
