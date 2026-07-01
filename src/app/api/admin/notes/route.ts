import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';

export async function POST(request: Request) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });
    const supabase = await createClient();

    const body = await request.json();
    const { person_id, content, category } = body;

    if (!person_id || !content || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await assertTenantRecords('people', [person_id], churchId, 'people');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        church_id: churchId,
        person_id,
        content,
        category,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
