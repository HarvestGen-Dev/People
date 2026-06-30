import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const { data, error } = await supabase
      .from('workflow_cards')
      .insert({
        workflow_id: body.workflow_id,
        current_step_id: body.current_step_id,
        person_id: body.person_id,
        assigned_to: body.assigned_to || null,
        due_date: body.due_date || null,
        notes: body.notes || null
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
