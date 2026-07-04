import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function GET() {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tags')
      .select('*, person_tags(count)')
      .eq('church_id', churchId)
      .order('name');

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const body = await request.json();

    const { data, error } = await supabase
      .from('tags')
      .insert({
        church_id: churchId,
        name: body.name,
        color: body.color,
        target_workflow_id: body.target_workflow_id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
