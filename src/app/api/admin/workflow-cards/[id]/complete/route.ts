import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { dispatchWebhook } from '@/lib/webhooks';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const { id } = await params;

    const { data, error } = await supabase
      .from('workflow_cards')
      .update({
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('*, workflows(name, church_id), workflow_steps(name)')
      .single();

    if (error) throw error;

    // Webhook dispatch
    if (data) {
      await dispatchWebhook(churchId, 'person.status_changed', {
        person_id: data.person_id,
        workflow: data.workflows.name,
        step: data.workflow_steps?.name || 'Completed',
        completed: true
      });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
