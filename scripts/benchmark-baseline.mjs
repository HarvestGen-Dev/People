// <!-- AGENT: BACKEND -->
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:56321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const port = Number(process.env.BENCHMARK_PORT || 3000);
const baseUrl = `http://127.0.0.1:${port}`;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helper for timing
async function timeOperation(fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

// Calculate percentiles
function stats(latencies) {
  if (latencies.length === 0) return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (pct) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))];
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: +sorted[0].toFixed(1),
    p50: +p(50).toFixed(1),
    p95: +p(95).toFixed(1),
    p99: +p(99).toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
    avg: +(sum / sorted.length).toFixed(1),
  };
}

async function getAuthCookie(email, password, churchId) {
  const cookieJar = new Map();
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => cookieJar.set(name, value));
      },
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error('Sign in failed');

  cookieJar.set('people_church_id', churchId);
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}

export async function runBenchmarks({ concurrentUsers = [1, 25, 50, 100], requestsPerUser = 5 } = {}) {
  console.log(`\n==================================================`);
  console.log(`     HARVESTGEN PEOPLE PERFORMANCE BENCHMARK       `);
  console.log(`==================================================`);

  // 1. Resolve benchmark church & sample person
  const { data: church } = await admin
    .from('churches')
    .select('id, name')
    .eq('slug', 'harvestgen-benchmark')
    .single();

  if (!church) {
    console.error('Benchmark church not found! Run seed-staging-data.mjs first.');
    return;
  }

  const { data: person } = await admin
    .from('people')
    .select('id, display_id')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  const { data: tag } = await admin
    .from('tags')
    .select('id, name')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  const { data: workflow } = await admin
    .from('workflows')
    .select('id, display_id')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  console.log(`Church: ${church.name} (${church.id})`);
  console.log(`Sample person ID: ${person?.id} (${person?.display_id})`);
  console.log(`Sample tag: ${tag?.name} (${tag?.id})`);
  console.log(`Sample workflow: ${workflow?.id} (${workflow?.display_id})`);

  // Obtain cookies for admin user
  const adminCookie = await getAuthCookie(
    'benchmark.user1@harvestgen.test',
    'Password123!',
    church.id
  );

  // Measure Raw Database Operations
  console.log(`\n--- 1. Raw PostgreSQL Query Baseline (via service client) ---`);
  
  // A. People Directory unfiltered
  const dbPeopleTimes = [];
  for (let i = 0; i < 10; i++) {
    const { duration } = await timeOperation(async () => {
      return admin
        .from('people')
        .select('id, display_id, first_name, last_name, email, phone, status, campus, photo_url, photo_path, created_at, updated_at', { count: 'exact' })
        .eq('church_id', church.id)
        .order('last_name', { ascending: true })
        .range(0, 49);
    });
    dbPeopleTimes.push(duration);
  }
  console.log(`People Directory (50 rows + exact count):`, stats(dbPeopleTimes));

  // B. People Directory ILIKE search
  const dbSearchTimes = [];
  for (let i = 0; i < 10; i++) {
    const { duration } = await timeOperation(async () => {
      return admin
        .from('people')
        .select('id, display_id, first_name, last_name, email, phone, status', { count: 'exact' })
        .eq('church_id', church.id)
        .or('first_name.ilike.%Tan%,last_name.ilike.%Tan%,email.ilike.%Tan%')
        .order('last_name', { ascending: true })
        .range(0, 49);
    });
    dbSearchTimes.push(duration);
  }
  console.log(`People Search (ILIKE %Tan% + exact count):`, stats(dbSearchTimes));

  // C. Tag filter via in-memory person_tags
  const dbTagTimes = [];
  for (let i = 0; i < 10; i++) {
    const { duration } = await timeOperation(async () => {
      const { data: tagRows } = await admin
        .from('person_tags')
        .select('person_id')
        .eq('church_id', church.id)
        .eq('tag_id', tag.id);
      const ids = (tagRows || []).map((r) => r.person_id);
      return admin
        .from('people')
        .select('id, display_id, first_name, last_name, email, phone, status', { count: 'exact' })
        .eq('church_id', church.id)
        .in('id', ids)
        .range(0, 49);
    });
    dbTagTimes.push(duration);
  }
  console.log(`People Tag Filter (2 round-trips + ID.in array):`, stats(dbTagTimes));

  // D. Dashboard RPC
  const dbSummaryTimes = [];
  for (let i = 0; i < 10; i++) {
    const { duration } = await timeOperation(async () => {
      return admin.rpc('get_dashboard_summary', { p_church_id: church.id });
    });
    dbSummaryTimes.push(duration);
  }
  console.log(`Dashboard RPC (get_dashboard_summary):`, stats(dbSummaryTimes));

  // E. Sequential Signed Photo URLs (50 photos)
  console.log(`\n--- 2. Photo URL Signing Baseline ---`);
  const { data: peopleWithPhotos } = await admin
    .from('people')
    .select('id, photo_path')
    .eq('church_id', church.id)
    .not('photo_path', 'is', null)
    .limit(50);

  if (peopleWithPhotos && peopleWithPhotos.length > 0) {
    // Sequential / Promise.all individual
    const { duration: seqDuration } = await timeOperation(async () => {
      return Promise.all(
        peopleWithPhotos.map((p) =>
          admin.storage.from('people-photos').createSignedUrl(p.photo_path, 600)
        )
      );
    });
    console.log(`Individual Promise.all signing for ${peopleWithPhotos.length} photos: ${seqDuration.toFixed(1)}ms`);

    // Batch signing
    const paths = peopleWithPhotos.map((p) => p.photo_path);
    const { duration: batchDuration } = await timeOperation(async () => {
      return admin.storage.from('people-photos').createSignedUrls(paths, 600);
    });
    console.log(`Batch createSignedUrls for ${paths.length} photos: ${batchDuration.toFixed(1)}ms`);
    console.log(`Speedup factor: ${(seqDuration / batchDuration).toFixed(1)}x`);
  }

  // 3. Next.js Route Latency (HTTP)
  console.log(`\n--- 3. Authenticated Route Response Times (1 user, sequential) ---`);
  const routes = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'People Directory (p1)', path: '/people' },
    { name: 'People Search (?search=Tan)', path: '/people?search=Tan' },
    { name: 'People Tag (?tag=' + tag.id + ')', path: `/people?tag=${tag.id}` },
    { name: 'Person Profile', path: `/people/${person.display_id || person.id}` },
    { name: 'Workflows Board', path: `/workflows/${workflow?.display_id || workflow?.id}` },
    { name: 'Events Index', path: '/events' },
  ];

  for (const r of routes) {
    const latencies = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const res = await fetch(`${baseUrl}${r.path}`, {
        headers: { Cookie: adminCookie },
      });
      await res.text();
      const duration = performance.now() - start;
      if (res.status === 200) {
        latencies.push(duration);
      } else {
        console.warn(`Route ${r.path} returned status ${res.status}`);
      }
    }
    console.log(`${r.name.padEnd(35)}:`, stats(latencies));
  }

  // 4. Concurrency Simulation
  for (const vu of concurrentUsers) {
    console.log(`\n--- 4. Concurrency Test: ${vu} Concurrent Users ---`);
    const allLatencies = [];
    let errorCount = 0;
    const testStarted = performance.now();

    const vuTask = async () => {
      // Pick random route
      for (let req = 0; req < requestsPerUser; req++) {
        const route = routes[Math.floor(Math.random() * routes.length)];
        const start = performance.now();
        try {
          const res = await fetch(`${baseUrl}${route.path}`, {
            headers: { Cookie: adminCookie },
          });
          await res.text();
          const elapsed = performance.now() - start;
          if (res.status >= 500) {
            errorCount++;
          } else {
            allLatencies.push(elapsed);
          }
        } catch {
          errorCount++;
        }
      }
    };

    const vuPromises = [];
    for (let i = 0; i < vu; i++) {
      vuPromises.push(vuTask(i));
    }
    await Promise.all(vuPromises);

    const totalTimeSec = (performance.now() - testStarted) / 1000;
    const totalRequests = allLatencies.length + errorCount;
    const rps = (totalRequests / totalTimeSec).toFixed(1);

    console.log(`Virtual Users: ${vu}`);
    console.log(`Total Requests: ${totalRequests} across ${totalTimeSec.toFixed(2)}s (${rps} req/sec)`);
    console.log(`5xx Error Rate: ${((errorCount / (totalRequests || 1)) * 100).toFixed(2)}% (${errorCount} errors)`);
    console.log(`Latency:`, stats(allLatencies));
  }

  console.log(`\n==================================================\n`);
}

// Allow CLI execution
if (process.argv[1]?.endsWith('benchmark-baseline.mjs')) {
  runBenchmarks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
