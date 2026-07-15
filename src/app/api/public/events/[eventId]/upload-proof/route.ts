// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateImageUpload } from '@/lib/image-upload';
import { enforcePublicRateLimit } from '@/lib/public-rate-limit';

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const limited = await enforcePublicRateLimit(request, {
      bucket: 'public:event-proof-upload',
      scope: eventId,
      limit: 10,
      windowSeconds: 60 * 60,
      error: 'Too many upload attempts. Please try again later.',
    });
    if (limited) return limited;

    const supabase = createServiceClient();
    const { data: event } = await supabase
      .from('events')
      .select('id, church_id, price, status')
      .eq('id', eventId)
      .maybeSingle();

    if (!event || event.status !== 'published' || event.price <= 0) {
      return NextResponse.json(
        { error: 'Paid event not found or not published' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const image = validateImageUpload(formData.get('file'), 5 * 1024 * 1024);
    if ('error' in image) {
      return NextResponse.json({ error: image.error }, { status: 400 });
    }

    const timestamp = Date.now();
    const randomString = crypto.randomUUID();
    const filePath = `${event.church_id}/${event.id}/${timestamp}-${randomString}.${image.extension}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, image.file, { upsert: false });

    if (uploadError) {
      console.error('Payment proof upload error:', uploadError.message);
      return NextResponse.json(
        { error: 'Unable to upload proof. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { path: filePath } });
  } catch (error: unknown) {
    console.error(
      'Payment proof upload error:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: 'Unable to upload proof. Please try again later.' },
      { status: 500 }
    );
  }
}
