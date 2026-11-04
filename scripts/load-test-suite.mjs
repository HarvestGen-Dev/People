// <!-- AGENT: BACKEND -->
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:56321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const port = Number(process.env.LOAD_TEST_PORT || 3119);
const baseUrl = `http://127.0.0.1:${port}`;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (pct) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))];
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: +sorted[0].toFixed(1),
    p50: +p(50).toFixed(1),
    p90: +p(90).toFixed(1),
    p95: +p(95).toFixed(1),
    p99: +p(99).toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
    avg: +(sum / sorted.length).toFixed(1),
  };
}

async function getSessionCookie(email, password, churchId) {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runLoadTestSuite() {
  console.log(`======================================================================`);
  console.log(`       HARVESTGEN PEOPLE - COMPREHENSIVE LOAD TEST SUITE              `);
  console.log(`======================================================================`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Database: ${supabaseUrl}`);

  // 1. Locate test church & sample entities
  const { data: church } = await admin
    .from('churches')
    .select('id, name')
    .eq('slug', 'harvestgen-benchmark')
    .single();

  if (!church) {
    console.error('Benchmark church not found. Run scripts/seed-staging-data.mjs first.');
    process.exit(1);
  }

  const { data: person } = await admin
    .from('people')
    .select('id, display_id')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  const { data: tag } = await admin
    .from('tags')
    .select('id')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  const { data: workflow } = await admin
    .from('workflows')
    .select('id, display_id')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  const { data: event } = await admin
    .from('events')
    .select('id, display_id, capacity')
    .eq('church_id', church.id)
    .limit(1)
    .single();

  console.log(`Tenant Church: ${church.name} (${church.id})`);
  console.log(`Sample Person: ${person?.display_id || person?.id}`);
  console.log(`Sample Event:  ${event?.id} (capacity: ${event?.capacity})`);

  // Obtain cookies for tenant user
  const authCookie = await getSessionCookie(
    'benchmark.user1@harvestgen.test',
    'Password123!',
    church.id
  );

  // Journeys to simulate typical church staff and volunteer operations
  const readEndpoints = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'People Directory (p1)', path: '/people' },
    { name: 'People Search (Name)', path: '/people?search=Tan' },
    { name: 'People Search (Phone)', path: '/people?search=012' },
    { name: 'People Filter (Tag)', path: `/people?tag=${tag?.id}` },
    { name: 'Person Profile', path: `/people/${person?.display_id || person?.id}` },
    { name: 'Workflow Board', path: `/workflows/${workflow?.display_id || workflow?.id}` },
    { name: 'Events Index', path: '/events' },
    { name: 'Event Registrations', path: `/events/${event?.display_id || event?.id}/registrations` },
  ];

  const workloads = [
    { title: 'Test 1: Light Load', vus: 25, iterations: 6, thinkTimeMs: 80 },
    { title: 'Test 2: Typical Peak', vus: 50, iterations: 6, thinkTimeMs: 60 },
    { title: 'Test 3: Target Peak', vus: 100, iterations: 6, thinkTimeMs: 40 },
    { title: 'Test 4: Short Burst', vus: 150, iterations: 4, thinkTimeMs: 20 },
  ];

  const resultsSummary = [];

  for (const wl of workloads) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`  ${wl.title} (${wl.vus} Concurrent VUs, ${wl.iterations} requests/VU)`);
    console.log(`----------------------------------------------------------------------`);

    const latencies = [];
    let errors5xx = 0;
    let errors4xx = 0;
    const testStart = performance.now();

    const runVirtualUser = async (vuId) => {
      for (let i = 0; i < wl.iterations; i++) {
        const target = readEndpoints[Math.floor(Math.random() * readEndpoints.length)];
        const reqStart = performance.now();
        try {
          const res = await fetch(`${baseUrl}${target.path}`, {
            headers: {
              Cookie: authCookie,
              'x-request-id': `load-${vuId}-${i}-${Date.now()}`,
            },
          });
          await res.text();
          const elapsed = performance.now() - reqStart;

          if (res.status >= 500) {
            errors5xx++;
          } else if (res.status >= 400) {
            errors4xx++;
          } else {
            latencies.push(elapsed);
          }
        } catch {
          errors5xx++;
        }

        // Realistic user think time
        if (wl.thinkTimeMs > 0) {
          await sleep(wl.thinkTimeMs + Math.floor(Math.random() * 20));
        }
      }
    };

    const vuPromises = [];
    for (let vu = 0; vu < wl.vus; vu++) {
      vuPromises.push(runVirtualUser(vu));
    }
    await Promise.all(vuPromises);

    const testDurationSec = (performance.now() - testStart) / 1000;
    const totalRequests = latencies.length + errors5xx + errors4xx;
    const rps = (totalRequests / testDurationSec).toFixed(1);
    const metrics = calculatePercentiles(latencies);
    const errorRate = ((errors5xx / totalRequests) * 100).toFixed(2);

    console.log(`Total Requests:    ${totalRequests}`);
    console.log(`Duration:          ${testDurationSec.toFixed(2)}s`);
    console.log(`Throughput:        ${rps} req/sec`);
    console.log(`5xx Error Rate:    ${errorRate}% (${errors5xx} errors)`);
    console.log(`Latency p50:       ${metrics.p50} ms`);
    console.log(`Latency p90:       ${metrics.p90} ms`);
    console.log(`Latency p95:       ${metrics.p95} ms`);
    console.log(`Latency p99:       ${metrics.p99} ms`);
    console.log(`Latency Max:       ${metrics.max} ms`);

    const meetsP95 = metrics.p95 <= 1500;
    const meetsErrorRate = parseFloat(errorRate) <= 0.5;

    console.log(`Status:            ${meetsP95 && meetsErrorRate ? 'PASS (meets performance targets)' : 'FAIL'}`);

    resultsSummary.push({
      workload: wl.title,
      vus: wl.vus,
      totalRequests,
      rps,
      p50: metrics.p50,
      p95: metrics.p95,
      p99: metrics.p99,
      errorRate: `${errorRate}%`,
      status: meetsP95 && meetsErrorRate ? 'PASS' : 'WARN',
    });
  }

  // 5. Write Concurrency Test (Event Registration race conditions)
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`  Write Concurrency: Race-Condition & Capacity Integrity Test        `);
  console.log(`----------------------------------------------------------------------`);

  // Create limited capacity event (10 spots)
  const eventSlug = `race-test-${Date.now().toString(36)}`;
  const { data: raceEvent } = await admin
    .from('events')
    .insert({
      church_id: church.id,
      name: 'High Concurrency Capacity Test',
      slug: eventSlug,
      status: 'published',
      capacity: 10,
      price: 0,
      currency: 'MYR',
      start_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select('id')
    .single();

  if (raceEvent) {
    // 30 concurrent users attempt to claim the 10 spots simultaneously
    console.log(`Submitting 30 simultaneous registrations for 10-capacity event...`);
    const regPromises = [];
    const regResults = [];

    for (let i = 0; i < 30; i++) {
      regPromises.push(
        (async () => {
          const res = await fetch(`${baseUrl}/api/public/events/${raceEvent.id}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              first_name: `Contender`,
              last_name: `${i}`,
              email: `contender.${i}.${Date.now()}@example.my`,
              phone: `+6012888${String(i).padStart(4, '0')}`,
              guests: 1,
            }),
          });
          const json = await res.json();
          regResults.push({ status: res.status, body: json });
        })()
      );
    }
    await Promise.all(regPromises);

    const { count: finalCount } = await admin
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', raceEvent.id);

    console.log(`Final approved/claimed registrations in DB: ${finalCount} / 10 capacity.`);
    assert.ok((finalCount || 0) <= 10, 'Capacity was not exceeded under concurrent writes');
    console.log(`Capacity integrity: PASS (Zero over-booking)`);

    // Clean up race event
    await admin.from('events').delete().eq('id', raceEvent.id);
  }

  // 6. Cross-Tenant Isolation Security Test
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`  Multi-Tenant Security: Cross-Tenant Isolation Verification          `);
  console.log(`----------------------------------------------------------------------`);

  // Create unrelated church
  const { data: otherChurch } = await admin
    .from('churches')
    .insert({
      slug: `isolated-church-${Date.now().toString(36)}`,
      name: 'Isolated Security Church',
    })
    .select('id')
    .single();

  if (otherChurch) {
    // Attempt to access Benchmark Church using other Church ID cookie
    const crossTenantCookie = await getSessionCookie(
      'benchmark.user1@harvestgen.test',
      'Password123!',
      otherChurch.id
    );

    const checkRes = await fetch(`${baseUrl}/api/v1/people`, {
      headers: {
        Cookie: crossTenantCookie,
      },
    });

    console.log(`Cross-tenant API request returned status: ${checkRes.status}`);
    assert.ok(
      checkRes.status === 401 || checkRes.status === 403,
      'Cross-tenant access without API key or membership was blocked'
    );
    console.log(`Tenant data isolation: PASS (Zero cross-tenant leakage)`);

    await admin.from('churches').delete().eq('id', otherChurch.id);
  }

  console.log(`\n======================================================================`);
  console.log(`                         LOAD TEST SUMMARY REPORT                     `);
  console.log(`======================================================================`);
  console.table(resultsSummary);
  console.log(`======================================================================\n`);
}

if (process.argv[1]?.endsWith('load-test-suite.mjs')) {
  runLoadTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
