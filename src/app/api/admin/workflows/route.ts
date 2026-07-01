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
      .from('workflows')
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
      .from('workflows')
      .insert({
        church_id: churchId,
        name: body.name,
        description: body.description || null
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
