import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import {
  assertTenantAssignee,
  assertTenantRecords,
  assertWorkflowStep,
} from '@/lib/tenant-references';

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireWorkflowManager: true });
    const supabase = createServiceClient();

    const body = await request.json();
    await Promise.all([
      assertTenantRecords(
        'workflows',
        [body.workflow_id],
        churchId,
        'workflows'
      ),
      assertTenantRecords(
        'people',
        [body.person_id],
        churchId,
        'people'
      ),
      assertWorkflowStep(
        body.current_step_id,
        body.workflow_id,
        churchId
      ),
      assertTenantAssignee(body.assigned_to, churchId),
    ]);

    let dueDate = body.due_date || null;
    if (!dueDate && body.current_step_id) {
      const { data: step } = await supabase
        .from('workflow_steps')
        .select('default_days_to_complete')
        .eq('id', body.current_step_id)
        .single();
      
      if (step?.default_days_to_complete) {
        const d = new Date();
        d.setDate(d.getDate() + step.default_days_to_complete);
        dueDate = d.toISOString().split('T')[0];
      }
    }

    const { data, error } = await supabase
      .from('workflow_cards')
      .insert({
        church_id: churchId,
        workflow_id: body.workflow_id,
        current_step_id: body.current_step_id,
        person_id: body.person_id,
        assigned_to: body.assigned_to || null,
        due_date: dueDate,
        notes: body.notes || null
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
