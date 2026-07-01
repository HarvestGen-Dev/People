import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function GET(request: Request) {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = createServiceClient();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from('people')
      .select('id, first_name, last_name, email, phone, status')
      .eq('church_id', churchId)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
