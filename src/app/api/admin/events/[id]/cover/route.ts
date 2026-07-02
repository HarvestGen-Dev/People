// <!-- AGENT: BACKEND -->
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateImageUpload } from '@/lib/image-upload';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { id } = await params;
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const image = validateImageUpload(formData.get('file'), 5 * 1024 * 1024);
    if ('error' in image) {
      return NextResponse.json({ error: image.error }, { status: 400 });
    }

    const timestamp = Date.now();
    const filePath = `${churchId}/${id}/${timestamp}.${image.extension}`;
    const storage = createServiceClient().storage;

    const { error: uploadError } = await storage
      .from('event-covers')
      .upload(filePath, image.file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = storage
      .from('event-covers')
      .getPublicUrl(filePath);

    // Update the event with the new photo URL
    const { error: updateError } = await supabase
      .from('events')
      .update({ cover_image_url: publicUrl })
      .eq('id', id)
      .eq('church_id', churchId);

    if (updateError) throw updateError;

    return NextResponse.json({ data: { url: publicUrl } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
