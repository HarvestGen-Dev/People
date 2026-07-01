import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = createServiceClient();

    const { id } = await params;
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('workflows')
      .update({
        name: body.name,
        description: body.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('church_id', churchId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const { id } = await params;

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;
    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
