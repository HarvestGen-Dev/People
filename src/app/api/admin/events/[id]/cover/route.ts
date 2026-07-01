import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
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
    const file = formData.get('file') as File;

    if (!file || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filePath = `${churchId}/${id}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('event-covers')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
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
