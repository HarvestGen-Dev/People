import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { applyDisplayOrDatabaseIdFilter } from '@/lib/display-ids';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });
    const supabase = await createClient();

    const { id } = await params;
    
    // 1. Fetch original event
    const originalQuery = supabase
      .from('events')
      .select('*')
      .eq('church_id', churchId);

    const { data: original, error: fetchError } = await applyDisplayOrDatabaseIdFilter(originalQuery, id)
      .single();

    if (fetchError || !original) throw new Error('Original event not found');

    // 2. Determine new unique slug
    const baseSlug = `${original.slug}-copy`;
    let newSlug = baseSlug;
    
    const checkUniqueSlug = async (testSlug: string): Promise<string> => {
      const { data } = await supabase.from('events').select('id').eq('church_id', churchId).eq('slug', testSlug).maybeSingle();
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
    const eventPayload: Partial<typeof original> = { ...original };
    delete eventPayload.id;
    delete eventPayload.display_id;
    delete eventPayload.created_at;
    delete eventPayload.updated_at;
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
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
