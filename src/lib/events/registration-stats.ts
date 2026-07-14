// <!-- AGENT: BACKEND -->
import type { SupabaseClient } from '@supabase/supabase-js';

export type EventRegistrationStats = {
  event_id: string;
  registration_count: number;
  pending_count: number;
  approved_count: number;
  active_guest_count: number;
  pending_guest_count: number;
  approved_guest_count: number;
};

type RawEventRegistrationStats = {
  event_id: string;
  registration_count: number | string | null;
  pending_count: number | string | null;
  approved_count: number | string | null;
  active_guest_count: number | string | null;
  pending_guest_count: number | string | null;
  approved_guest_count: number | string | null;
};

const toCount = (value: number | string | null) => Number(value ?? 0);

function normalizeStats(row: RawEventRegistrationStats): EventRegistrationStats {
  return {
    event_id: row.event_id,
    registration_count: toCount(row.registration_count),
    pending_count: toCount(row.pending_count),
    approved_count: toCount(row.approved_count),
    active_guest_count: toCount(row.active_guest_count),
    pending_guest_count: toCount(row.pending_guest_count),
    approved_guest_count: toCount(row.approved_guest_count),
  };
}

export async function getEventRegistrationStats(
  supabase: SupabaseClient,
  churchId: string,
  eventIds: string[]
): Promise<Record<string, EventRegistrationStats>> {
  if (eventIds.length === 0) return {};

  const { data, error } = await supabase.rpc('event_registration_stats', {
    p_church_id: churchId,
    p_event_ids: eventIds,
  });

  if (error) {
    throw new Error(`Unable to load event registration stats: ${error.message}`);
  }

  return ((data || []) as RawEventRegistrationStats[]).reduce<
    Record<string, EventRegistrationStats>
  >((result, row) => {
    const stats = normalizeStats(row);
    result[stats.event_id] = stats;
    return result;
  }, {});
}

export async function getSingleEventRegistrationStats(
  supabase: SupabaseClient,
  churchId: string,
  eventId: string
): Promise<EventRegistrationStats> {
  const statsByEvent = await getEventRegistrationStats(supabase, churchId, [
    eventId,
  ]);

  return (
    statsByEvent[eventId] || {
      event_id: eventId,
      registration_count: 0,
      pending_count: 0,
      approved_count: 0,
      active_guest_count: 0,
      pending_guest_count: 0,
      approved_guest_count: 0,
    }
  );
}
