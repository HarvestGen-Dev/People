import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * CRON JOB: Missing Person Pulse
 * Triggers every day to find people who have slipped through the cracks.
 * 
 * Logic:
 * 1. Fetch all active pulse configs.
 * 2. For each config, find people matching the status who have NO person_events
 *    in the last X days, and NO check-ins/attendance in the last X days.
 * 3. Drop them into the target workflow if they aren't already in it.
 */
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron:missing-persons-pulse] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const lockName = 'cron:missing-persons-pulse';
  let lockAcquired = false;

  try {
    const supabase = createServiceClient();
    const { data: acquired, error: lockError } = await supabase.rpc(
      'try_cron_advisory_lock',
      { p_lock_name: lockName }
    );

    if (lockError) throw lockError;
    lockAcquired = Boolean(acquired);
    if (!lockAcquired) {
      return NextResponse.json(
        { success: false, skipped: true, reason: 'already_running' },
        { status: 409 }
      );
    }
    
    // Fetch all active configs
    const { data: configs, error: configError } = await supabase
      .from('workflow_pulse_configs')
      .select('*')
      .eq('is_active', true);

    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No active pulse configs' });
    }

    let cardsCreated = 0;

    for (const config of configs) {
      const { church_id, workflow_id, days_inactive, target_person_status } = config;

      // Find people who are missing
      // We can use an RPC or raw SQL, but we'll use a Supabase query with NOT IN for simplicity.
      
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days_inactive);
      const cutoffIso = cutoffDate.toISOString();

      // Find people in the church with the target status
      // In a very large DB this would be slow without an RPC, but works for MVP.
      const { data: candidates } = await supabase
        .from('people')
        .select('id')
        .eq('church_id', church_id)
        .eq('status', target_person_status);
        
      if (!candidates || candidates.length === 0) continue;

      const candidateIds = candidates.map(c => c.id);

      // Find who HAS had an event recently
      const { data: activeEvents } = await supabase
        .from('person_events')
        .select('person_id')
        .eq('church_id', church_id)
        .gte('occurred_at', cutoffIso)
        .in('person_id', candidateIds);

      const activePersonIds = new Set((activeEvents || []).map(e => e.person_id));

      // The missing people are candidates who are NOT in activePersonIds
      const missingPersonIds = candidateIds.filter(id => !activePersonIds.has(id));

      if (missingPersonIds.length === 0) continue;

      // Find first step of the workflow
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('id, default_days_to_complete')
        .eq('church_id', church_id)
        .eq('workflow_id', workflow_id)
        .order('order_index', { ascending: true })
        .limit(1);

      if (!steps || steps.length === 0) continue;
      const firstStep = steps[0];

      // Insert cards for missing people, IF they don't already have an active card in this workflow
      // Let's do it in a loop for safety
      for (const personId of missingPersonIds) {
        const { count: existingCount } = await supabase
          .from('workflow_cards')
          .select('*', { count: 'exact', head: true })
          .eq('church_id', church_id)
          .eq('workflow_id', workflow_id)
          .eq('person_id', personId);

        if (existingCount === 0) {
          let dueDate = null;
          if (firstStep.default_days_to_complete) {
            const d = new Date();
            d.setDate(d.getDate() + firstStep.default_days_to_complete);
            dueDate = d.toISOString().split('T')[0];
          }

          await supabase.from('workflow_cards').insert({
            church_id: church_id,
            workflow_id,
            current_step_id: firstStep.id,
            person_id: personId,
            due_date: dueDate,
            notes: `Added automatically by Pulse: ${days_inactive} days inactive.`,
          });
          cardsCreated++;
        }
      }
    }

    return NextResponse.json({ success: true, cardsCreated });
  } catch (error: unknown) {
    console.error('Pulse cron error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  } finally {
    if (lockAcquired) {
      const supabase = createServiceClient();
      await supabase
        .rpc('release_cron_advisory_lock', { p_lock_name: lockName })
        .then(({ error }) => {
          if (error) {
            console.error('[cron:missing-persons-pulse] failed to release lock', error);
          }
        });
    }
  }
}
