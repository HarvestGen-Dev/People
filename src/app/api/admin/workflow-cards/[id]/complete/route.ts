import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { dispatchWebhook } from '@/lib/webhooks';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { data, error } = await supabase
      .from('workflow_cards')
      .update({
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, workflows(name, church_id), workflow_steps(name)')
      .single();

    if (error) throw error;

    // Webhook dispatch
    if (data) {
      dispatchWebhook(data.workflows.church_id, 'person.status_changed', {
        person_id: data.person_id,
        workflow: data.workflows.name,
        step: data.workflow_steps?.name || 'Completed',
        completed: true
      });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
