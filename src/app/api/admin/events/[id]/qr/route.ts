import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
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
    const filePath = `${id}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-qr')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('payment-qr')
      .getPublicUrl(filePath);

    // Update the event with the new photo URL
    const { error: updateError } = await supabase
      .from('events')
      .update({ payment_qr_url: publicUrl })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({ data: { url: publicUrl } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
