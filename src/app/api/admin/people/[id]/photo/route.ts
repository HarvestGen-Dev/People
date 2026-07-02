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
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const image = validateImageUpload(formData.get('file'), 2 * 1024 * 1024);
    if ('error' in image) {
      return NextResponse.json({ error: image.error }, { status: 400 });
    }

    const timestamp = Date.now();
    const filePath = `${churchId}/${id}/${timestamp}.${image.extension}`;
    const storage = createServiceClient().storage;

    const { error: uploadError } = await storage
      .from('people-photos')
      .upload(filePath, image.file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = storage
      .from('people-photos')
      .getPublicUrl(filePath);

    // Update the person with the new photo URL
    const { error: updateError } = await supabase
      .from('people')
      .update({ photo_url: publicUrl })
      .eq('id', id)
      .eq('church_id', churchId);

    if (updateError) throw updateError;

    return NextResponse.json({ data: { photo_url: publicUrl } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
