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
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filePath = `${churchId}/${id}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('people-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
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
