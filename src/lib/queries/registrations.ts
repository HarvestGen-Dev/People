import { createServiceClient } from '@/lib/supabase/server';
import { createRequestPerformanceTracker } from '@/lib/performance';
import type { EventRegistration } from '@/lib/types';

export interface RegistrationFilters {
  church_id: string;
  event_id: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export async function getRegistrations(filters: RegistrationFilters) {
  const supabase = createServiceClient();
  const perf = createRequestPerformanceTracker('registrations-query');
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('event_registrations')
    .select(
      `
        id,
        display_id,
        church_id,
        event_id,
        person_id,
        first_name,
        last_name,
        email,
        phone,
        guests,
        amount_due,
        payment_proof_url,
        paid_checkbox,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        confirmation_email_sent_at,
        created_at,
        updated_at
      `,
      { count: 'exact' }
    )
    .eq('church_id', filters.church_id)
    .eq('event_id', filters.event_id);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false }).range(start, end);

  const [registrationsRes, statusCountsRes] = await Promise.all([
    perf.track('registrations.page', query),
    perf.track(
      'registrations.status_counts',
      supabase.rpc('get_registration_status_counts', {
        p_church_id: filters.church_id,
        p_event_id: filters.event_id,
      })
    ),
  ]);

  const { data: registrations, error, count } = registrationsRes;

  if (error) {
    console.error('Error fetching registrations:', error);
    return { registrations: [], total: 0 };
  }

  if (statusCountsRes.error) {
    console.error('Error fetching registration status counts:', statusCountsRes.error);
  }

  const statusCountsData = Array.isArray(statusCountsRes.data)
    ? statusCountsRes.data[0]
    : null;
  const statusCounts = {
    all: Number(statusCountsData?.all_count || 0),
    pending_review: Number(statusCountsData?.pending_review_count || 0),
    approved: Number(statusCountsData?.approved_count || 0),
    rejected: Number(statusCountsData?.rejected_count || 0),
  };

  perf.log();
  return {
    registrations: ((registrations || []) as EventRegistration[]),
    total: count || 0,
    statusCounts,
  };
}
