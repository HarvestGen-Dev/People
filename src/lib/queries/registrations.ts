import { createClient } from '@/lib/supabase/server';
import type { EventRegistration } from '@/lib/types';

export interface RegistrationFilters {
  church_id: string;
  event_id: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export async function getRegistrations(filters: RegistrationFilters) {
  const supabase = await createClient();
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('event_registrations')
    .select('*', { count: 'exact' })
    .eq('church_id', filters.church_id)
    .eq('event_id', filters.event_id);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false }).range(start, end);

  const { data: registrations, error, count } = await query;

  if (error) {
    console.error('Error fetching registrations:', error);
    return { registrations: [], total: 0 };
  }

  // Get status counts
  const { data: statusCountsData } = await supabase
    .from('event_registrations')
    .select('status')
    .eq('church_id', filters.church_id)
    .eq('event_id', filters.event_id);

  const statusCounts = {
    all: statusCountsData?.length || 0,
    pending_review: statusCountsData?.filter(r => r.status === 'pending_review').length || 0,
    approved: statusCountsData?.filter(r => r.status === 'approved').length || 0,
    rejected: statusCountsData?.filter(r => r.status === 'rejected').length || 0,
  };

  const registrationsWithProofUrls = await Promise.all(
    (registrations || []).map(async (registration: EventRegistration) => {
      const storedProof = registration.payment_proof_url;
      if (!storedProof) return registration;

      const legacyPublicMarker = '/storage/v1/object/public/payment-proofs/';
      const markerIndex = storedProof.indexOf(legacyPublicMarker);
      const proofPath = markerIndex >= 0
        ? decodeURIComponent(storedProof.slice(markerIndex + legacyPublicMarker.length))
        : storedProof;

      if (/^https?:\/\//.test(proofPath)) return registration;

      const { data } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(proofPath, 60 * 60);

      return {
        ...registration,
        payment_proof_url: data?.signedUrl || null,
      };
    })
  );

  return {
    registrations: registrationsWithProofUrls,
    total: count || 0,
    statusCounts,
  };
}
