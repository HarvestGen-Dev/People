import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { id } = await params;

    const { data, error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id, name, key_prefix, scopes, is_active, expires_at, last_used_at, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
