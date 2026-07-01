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
      .from('field_definitions')
      .select('*')
      .eq('church_id', churchId)
      .order('position');

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

    // Get max position
    const { data: maxPosData } = await supabase
      .from('field_definitions')
      .select('position')
      .eq('church_id', churchId)
      .order('position', { ascending: false })
      .limit(1);
    
    const position = maxPosData && maxPosData.length > 0 ? maxPosData[0].position + 1 : 0;

    const { data, error } = await supabase
      .from('field_definitions')
      .insert({
        church_id: churchId,
        name: body.name,
        slug: body.slug,
        field_type: body.field_type,
        is_required: body.is_required,
        options: body.options,
        position,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
