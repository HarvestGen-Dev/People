import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { dispatchWebhook } from '@/lib/webhooks';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import {
  assertTenantAssignee,
  assertWorkflowStep,
} from '@/lib/tenant-references';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireWorkflowManager: true });
    const supabase = createServiceClient();

    const { id } = await params;
    const body = await request.json();

    const { data: oldCard } = await supabase
      .from('workflow_cards')
      .select('current_step_id, workflow_id')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (!oldCard) {
      return NextResponse.json(
        { error: 'Workflow card not found' },
        { status: 404 }
      );
    }

    await Promise.all([
      body.current_step_id !== undefined
        ? assertWorkflowStep(
            body.current_step_id,
            oldCard.workflow_id,
            churchId
          )
        : Promise.resolve(),
      body.assigned_to !== undefined
        ? assertTenantAssignee(body.assigned_to, churchId)
        : Promise.resolve(),
    ]);

    let dueDate = body.due_date;
    if (
      dueDate === undefined &&
      body.current_step_id !== undefined &&
      body.current_step_id !== oldCard.current_step_id
    ) {
      const { data: step } = await supabase
        .from('workflow_steps')
        .select('default_days_to_complete')
        .eq('id', body.current_step_id)
        .single();

      if (step?.default_days_to_complete) {
        const d = new Date();
        d.setDate(d.getDate() + step.default_days_to_complete);
        dueDate = d.toISOString().split('T')[0];
      } else {
        dueDate = null;
      }
    }

    const updates = {
      ...(body.current_step_id !== undefined
        ? { current_step_id: body.current_step_id }
        : {}),
      ...(body.assigned_to !== undefined
        ? { assigned_to: body.assigned_to || null }
        : {}),
      ...(dueDate !== undefined
        ? { due_date: dueDate || null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedCard, error } = await supabase
      .from('workflow_cards')
      .update(updates)
      .eq('id', id)
      .eq('church_id', churchId)
      .select('*, workflows(name, church_id), workflow_steps(name)')
      .single();

    if (error) throw error;

    // Check if step changed for webhook
    if (body.current_step_id && oldCard.current_step_id !== body.current_step_id && updatedCard) {
      dispatchWebhook(churchId, 'person.status_changed', {
        person_id: updatedCard.person_id,
        workflow: updatedCard.workflows.name,
        step: updatedCard.workflow_steps?.name,
        completed: false
      });
    }

    return NextResponse.json({ data: updatedCard });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireWorkflowManager: true });
    const supabase = createServiceClient();

    const { id } = await params;

    const { error } = await supabase
      .from('workflow_cards')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;
    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
