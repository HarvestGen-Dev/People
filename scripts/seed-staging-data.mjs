// <!-- AGENT: BACKEND -->
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:56321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FIRST_NAMES = [
  'Ahmad', 'Wei', 'Siti', 'Muthu', 'Jonathan', 'Grace', 'Joshua', 'Hannah',
  'Daniel', 'Esther', 'Samuel', 'Sarah', 'David', 'Rachel', 'Benjamin', 'Chloe',
  'Isaac', 'Faith', 'Timothy', 'Ruth', 'Caleb', 'Joy', 'Nathan', 'Deborah',
  'Aaron', 'Abigail', 'Joel', 'Mary', 'Luke', 'Lydia', 'Elijah', 'Rebecca',
  'Gabriel', 'Miriam', 'Matthew', 'Priscilla', 'Peter', 'Elizabeth', 'Paul', 'Anna',
  'Marcus', 'Tabitha', 'Silas', 'Phoebe', 'Titus', 'Joanna', 'Stephen', 'Dorcas',
  'Philip', 'Bernice', 'Andrew', 'Eunice', 'James', 'Salome', 'Thomas', 'Rhoda',
  'Bartholomew', 'Martha', 'Simon', 'Susanna'
];

const LAST_NAMES = [
  'Tan', 'Lim', 'Lee', 'Wong', 'Ng', 'Ong', 'Chong', 'Goh', 'Chan', 'Teo',
  'Low', 'Yap', 'Chua', 'Koh', 'Liew', 'Khoo', 'Sim', 'Lau', 'Chia', 'Tay',
  'Subramaniam', 'Ramasamy', 'Nadarajan', 'Krishnan', 'Murugan',
  'Ibrahim', 'Abdullah', 'Ismail', 'Othman', 'Rahman',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'
];

const STATUSES = ['active', 'visitor', 'child', 'inactive'];
const STATUS_WEIGHTS = [0.65, 0.20, 0.10, 0.05];

function pickStatus() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < STATUSES.length; i++) {
    acc += STATUS_WEIGHTS[i];
    if (r <= acc) return STATUSES[i];
  }
  return 'active';
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('--- Seeding Synthetic Staging Data ---');
  const startedAt = Date.now();

  // 1. Get or create primary benchmark church
  const churchSlug = 'harvestgen-benchmark';
  let churchId;
  const { data: existingChurch } = await admin
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .maybeSingle();

  if (existingChurch) {
    churchId = existingChurch.id;
    console.log(`Using existing church: ${churchSlug} (${churchId})`);
  } else {
    const { data: newChurch, error: churchError } = await admin
      .from('churches')
      .insert({
        slug: churchSlug,
        name: 'HarvestGen Benchmark Church',
      })
      .select('id')
      .single();
    if (churchError) throw churchError;
    churchId = newChurch.id;
    console.log(`Created benchmark church: ${churchSlug} (${churchId})`);
  }

  // 2. Create 150 auth users & memberships
  console.log('Checking / seeding 150 test users...');
  const roles = [
    { role: 'owner', count: 2 },
    { role: 'admin', count: 8 },
    { role: 'pastoral', count: 15 },
    { role: 'workflow_manager', count: 15 },
    { role: 'staff', count: 30 },
    { role: 'viewer', count: 40 },
    { role: 'member', count: 40 },
  ];

  let userIndex = 1;
  const createdUsers = [];

  for (const { role, count } of roles) {
    for (let i = 1; i <= count; i++) {
      const email = `benchmark.user${userIndex}@harvestgen.test`;
      const password = 'Password123!';

      let userId;
      const { data: userRes } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (userRes?.user) {
        userId = userRes.user.id;
      } else {
        // Find existing
        const { data: listRes } = await admin.auth.admin.listUsers();
        const found = listRes.users.find((u) => u.email === email);
        if (found) userId = found.id;
      }

      if (userId) {
        // Upsert church_membership
        await admin.from('church_memberships').upsert(
          {
            church_id: churchId,
            user_id: userId,
            role,
          },
          { onConflict: 'church_id,user_id' }
        );
        createdUsers.push({ id: userId, email, role });
      }
      userIndex++;
    }
  }
  console.log(`Configured ${createdUsers.length} users with tenant roles.`);

  // 3. Create Tags
  console.log('Seeding tags...');
  const tagDefs = [
    { name: 'First-time Guest', color: '#10B981' },
    { name: 'Second-time Guest', color: '#3B82F6' },
    { name: 'Water Baptism', color: '#6366F1' },
    { name: 'Life Group Member', color: '#EC4899' },
    { name: 'Life Group Leader', color: '#8B5CF6' },
    { name: 'Worship Team', color: '#F59E0B' },
    { name: 'AV & Production', color: '#EF4444' },
    { name: 'Kids Ministry', color: '#14B8A6' },
    { name: 'Usher / Greeter', color: '#F97316' },
    { name: 'Campus Core', color: '#059669' },
  ];

  const tags = [];
  for (const tagDef of tagDefs) {
    const { data: tag, error } = await admin
      .from('tags')
      .upsert(
        { church_id: churchId, name: tagDef.name, color: tagDef.color },
        { onConflict: 'church_id,name' }
      )
      .select('id, name')
      .single();
    if (!error && tag) tags.push(tag);
  }
  console.log(`Seeded ${tags.length} tags.`);

  // 4. Seed 2,500 people
  const { count: currentPeopleCount } = await admin
    .from('people')
    .select('*', { count: 'exact', head: true })
    .eq('church_id', churchId);

  const targetPeople = 2500;
  const toCreate = Math.max(0, targetPeople - (currentPeopleCount || 0));

  console.log(`Current people count: ${currentPeopleCount}. Need to seed: ${toCreate}...`);

  const BATCH_SIZE = 250;
  let seededPeopleCount = currentPeopleCount || 0;

  for (let batchStart = 0; batchStart < toCreate; batchStart += BATCH_SIZE) {
    const currentBatch = Math.min(BATCH_SIZE, toCreate - batchStart);
    const peopleRows = [];

    for (let i = 0; i < currentBatch; i++) {
      const idx = seededPeopleCount + i + 1;
      const firstName = randomChoice(FIRST_NAMES);
      const lastName = randomChoice(LAST_NAMES);
      const status = pickStatus();
      const hasEmail = Math.random() > 0.1;
      const hasPhone = Math.random() > 0.15;
      const hasPhoto = Math.random() > 0.4; // 60% have photos

      const personId = crypto.randomUUID();
      const photoPath = hasPhoto
        ? `${churchId}/${personId}/avatar.webp`
        : null;

      peopleRows.push({
        id: personId,
        church_id: churchId,
        first_name: firstName,
        last_name: lastName,
        status,
        email: hasEmail ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${idx}@example.my` : null,
        phone: hasPhone ? `+6012${String(idx).padStart(7, '0')}` : null,
        campus: Math.random() > 0.5 ? 'Main Sanctuary' : 'North Campus',
        photo_path: photoPath,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 365 * 86400000)).toISOString(),
      });
    }

    const { error: insertError } = await admin.from('people').insert(peopleRows);
    if (insertError) {
      console.error('Error inserting people batch:', insertError);
      break;
    }
    seededPeopleCount += currentBatch;
    process.stdout.write(`\rSeeded ${seededPeopleCount} / ${targetPeople} people...`);
  }
  console.log('\nPeople seeding complete.');

  // 5. Seed person_tags (around 3,000 tag assignments)
  console.log('Seeding person_tags assignments...');
  const { data: samplePeople } = await admin
    .from('people')
    .select('id')
    .eq('church_id', churchId)
    .limit(1500);

  if (samplePeople && tags.length > 0) {
    const personTagRows = [];
    for (const p of samplePeople) {
      // 1-3 tags per person
      const numTags = 1 + Math.floor(Math.random() * 3);
      const chosenTags = [...tags].sort(() => 0.5 - Math.random()).slice(0, numTags);
      for (const t of chosenTags) {
        personTagRows.push({
          church_id: churchId,
          person_id: p.id,
          tag_id: t.id,
        });
      }
    }

    // Insert in batches
    for (let i = 0; i < personTagRows.length; i += 500) {
      const slice = personTagRows.slice(i, i + 500);
      await admin.from('person_tags').upsert(slice, { onConflict: 'church_id,person_id,tag_id' });
    }
    console.log(`Seeded ${personTagRows.length} person_tags.`);
  }

  // 6. Workflows, Steps & Cards
  console.log('Seeding workflows and workflow cards...');
  const workflowsData = [
    {
      name: 'New Visitor Journey',
      steps: ['Welcome Call', 'Coffee Connect', 'Life Group Intro', 'Completed'],
    },
    {
      name: 'Baptism Pipeline',
      steps: ['Class Registered', 'Class Attended', 'Pastoral Interview', 'Baptism Day'],
    },
    {
      name: 'Volunteer Onboarding',
      steps: ['Application Received', 'Background Check', 'Ministry Training', 'Scheduled'],
    },
  ];

  for (const wf of workflowsData) {
    const { data: workflow } = await admin
      .from('workflows')
      .upsert({ church_id: churchId, name: wf.name }, { onConflict: 'church_id,name' })
      .select('id')
      .single();

    if (workflow) {
      const stepIds = [];
      for (let pos = 0; pos < wf.steps.length; pos++) {
        const stepName = wf.steps[pos];
        const { data: step } = await admin
          .from('workflow_steps')
          .upsert(
            {
              church_id: churchId,
              workflow_id: workflow.id,
              name: stepName,
              position: pos + 1,
            },
            { onConflict: 'church_id,workflow_id,name' }
          )
          .select('id')
          .single();
        if (step) stepIds.push(step.id);
      }

      // Add cards for first 100 people
      if (samplePeople && stepIds.length > 0) {
        const cardsToInsert = samplePeople.slice(0, 80).map((p, idx) => ({
          church_id: churchId,
          workflow_id: workflow.id,
          person_id: p.id,
          current_step_id: stepIds[idx % stepIds.length],
          due_date: new Date(Date.now() + (idx % 2 === 0 ? -1 : 1) * 86400000 * 3).toISOString(),
          completed_at: idx % 4 === 0 ? new Date().toISOString() : null,
        }));
        await admin.from('workflow_cards').upsert(cardsToInsert, {
          onConflict: 'church_id,workflow_id,person_id',
        });
      }
    }
  }
  console.log('Workflows and cards seeded.');

  // 7. Seed Events and Registrations
  console.log('Seeding events & registrations...');
  const eventsData = [
    {
      name: 'Sunday Encounter Service',
      slug: `sunday-encounter-${Date.now().toString(36)}`,
      status: 'published',
      start_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      capacity: 350,
      price: 0,
      currency: 'MYR',
    },
    {
      name: 'Leadership Summit 2026',
      slug: `leadership-summit-${Date.now().toString(36)}`,
      status: 'published',
      start_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      capacity: 150,
      price: 50,
      currency: 'MYR',
    },
  ];

  for (const ev of eventsData) {
    const { data: event } = await admin
      .from('events')
      .insert({
        church_id: churchId,
        name: ev.name,
        slug: ev.slug,
        status: ev.status,
        start_at: ev.start_at,
        capacity: ev.capacity,
        price: ev.price,
        currency: ev.currency,
      })
      .select('id')
      .single();

    if (event && samplePeople) {
      const regRows = samplePeople.slice(0, 100).map((p, idx) => ({
        church_id: churchId,
        event_id: event.id,
        person_id: p.id,
        first_name: `Attendee${idx}`,
        last_name: `Test${idx}`,
        email: `attendee${idx}@example.my`,
        phone: `+6011${String(idx).padStart(7, '0')}`,
        guests: 1,
        amount_due: ev.price,
        status: idx % 3 === 0 ? 'pending_review' : 'approved',
      }));
      await admin.from('event_registrations').insert(regRows);
    }
  }
  console.log('Events and registrations seeded.');

  // 8. Seed Recent Activity (person_events)
  console.log('Seeding person_events...');
  if (samplePeople) {
    const eventRows = samplePeople.slice(0, 300).map((p, idx) => ({
      church_id: churchId,
      person_id: p.id,
      source: idx % 2 === 0 ? 'check_in' : 'connect_form',
      event_type: 'service_attendance',
      occurred_at: new Date(Date.now() - (idx % 7) * 86400000).toISOString(),
    }));
    await admin.from('person_events').insert(eventRows);
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Seeding finished successfully in ${duration}s ===`);
  console.log(`Benchmark church: ${churchSlug} (id: ${churchId})`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
