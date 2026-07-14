import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function GET() {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const body = await request.json();

    const { data, error } = await supabase
      .from('lists')
      .insert({
        church_id: churchId,
        name: body.name,
        type: body.type,
        filters: body.filters || null
      })
      .select('id, display_id')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
