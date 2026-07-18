// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function GET() {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('person_proposed_updates')
      .select(`
        id,
        display_id,
        person_id,
        field_name,
        current_value,
        proposed_value,
        source,
        source_reference,
        status,
        submitted_at,
        reviewed_at,
        resolution_note,
        people!person_proposed_updates_church_person_fk!inner(id, display_id, first_name, last_name, church_id)
      `)
      .eq('church_id', churchId)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
