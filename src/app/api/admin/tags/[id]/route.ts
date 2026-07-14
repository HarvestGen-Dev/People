import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('tags')
      .update({ 
        name: body.name, 
        color: body.color,
        target_workflow_id: body.target_workflow_id !== undefined ? body.target_workflow_id : undefined,
      })
      .eq('id', id)
      .eq('church_id', churchId)
      .select()
      .single();

    if (error) throw error;
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'tag.updated',
      resourceType: 'tag',
      resourceDisplayId: data.display_id,
      metadata: {
        name: data.name,
        color: data.color,
      },
      request,
    });

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { id } = await params;

    const { data: tag } = await supabase
      .from('tags')
      .select('display_id, name, color')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'tag.deleted',
      resourceType: 'tag',
      resourceDisplayId: tag?.display_id || null,
      metadata: tag
        ? {
            name: tag.name,
            color: tag.color,
          }
        : null,
      request,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
