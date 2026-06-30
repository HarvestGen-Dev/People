import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { dispatchWebhook } from '@/lib/webhooks';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    
    // Prevent overriding completed_at via PATCH, handled by /complete
    delete body.completed_at;

    const { data: oldCard } = await supabase.from('workflow_cards').select('current_step_id').eq('id', id).single();

    const { data: updatedCard, error } = await supabase
      .from('workflow_cards')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, workflows(name, church_id), workflow_steps(name)')
      .single();

    if (error) throw error;

    // Check if step changed for webhook
    if (body.current_step_id && oldCard && oldCard.current_step_id !== body.current_step_id && updatedCard) {
      dispatchWebhook(updatedCard.workflows.church_id, 'person.status_changed', {
        person_id: updatedCard.person_id,
        workflow: updatedCard.workflows.name,
        step: updatedCard.workflow_steps?.name,
        completed: false
      });
    }

    return NextResponse.json({ data: updatedCard });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { error } = await supabase.from('workflow_cards').delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
