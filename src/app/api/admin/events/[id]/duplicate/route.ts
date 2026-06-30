import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    
    // 1. Fetch original event
    const { data: original, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) throw new Error('Original event not found');

    // 2. Determine new unique slug
    let baseSlug = `${original.slug}-copy`;
    let newSlug = baseSlug;
    
    const checkUniqueSlug = async (testSlug: string): Promise<string> => {
      const { data } = await supabase.from('events').select('id').eq('church_id', original.church_id).eq('slug', testSlug).maybeSingle();
      if (!data) return testSlug;
      // If taken, append '-2' or increment
      const match = testSlug.match(/-copy-(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return checkUniqueSlug(testSlug.replace(/-copy-\d+$/, `-copy-${nextNum}`));
      }
      return checkUniqueSlug(`${baseSlug}-2`);
    };

    newSlug = await checkUniqueSlug(baseSlug);

    // 3. Create payload (strip ID and timestamps, set status to draft)
    const { id: _id, created_at, updated_at, ...eventPayload } = original;
    eventPayload.slug = newSlug;
    eventPayload.name = `${original.name} (Copy)`;
    eventPayload.status = 'draft';
    eventPayload.created_by = user.email;

    // 4. Insert duplicate
    const { data: duplicate, error: insertError } = await supabase
      .from('events')
      .insert(eventPayload)
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ data: duplicate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
