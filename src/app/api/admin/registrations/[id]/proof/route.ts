// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError, requireTenantContext } from '@/lib/tenant-context';
import { createRequestPerformanceTracker } from '@/lib/performance';

function normalizeProofPath(storedProof: string) {
  const legacyPublicMarker = '/storage/v1/object/public/payment-proofs/';
  const markerIndex = storedProof.indexOf(legacyPublicMarker);

  if (markerIndex >= 0) {
    return decodeURIComponent(storedProof.slice(markerIndex + legacyPublicMarker.length));
  }

  return storedProof;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const { id } = await params;
    const supabase = createServiceClient();
    const perf = createRequestPerformanceTracker('registration-proof');

    const { data: registration, error } = await perf.track(
      'registration.proof_lookup',
      supabase
        .from('event_registrations')
        .select('id, payment_proof_url')
        .eq('church_id', churchId)
        .eq('id', id)
        .single()
    );

    if (error) throw error;
    if (!registration?.payment_proof_url) {
      perf.log();
      return NextResponse.json({ error: 'Payment proof not found' }, { status: 404 });
    }

    const proofPath = normalizeProofPath(registration.payment_proof_url);
    if (/^https?:\/\//.test(proofPath)) {
      perf.log();
      return NextResponse.json({ data: { url: proofPath } });
    }

    const { data, error: signedUrlError } = await perf.track(
      'registration.proof_signed_url',
      supabase.storage.from('payment-proofs').createSignedUrl(proofPath, 60 * 60)
    );

    if (signedUrlError) throw signedUrlError;
    perf.log();

    return NextResponse.json({ data: { url: data.signedUrl } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
