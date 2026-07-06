import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { slug } = await params;
    const body = await request.json();

    // 1. Find the active connect form by slug
    const { data: form, error: formError } = await supabase
      .from('connect_forms')
      .select('church_id, target_workflow_id, target_tag_id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Connect form not found or inactive' }, { status: 404 });
    }

    const churchId = form.church_id;

    // 2. Validate input
    const { first_name, last_name, email, phone, gender, birthdate, campus } = body;
    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    // 3. Create the person
    const personToInsert = {
      church_id: churchId,
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      gender: gender || null,
      birthdate: birthdate || null,
      campus: campus || null,
      status: 'visitor', // Default to visitor from connect forms
    };

    const { data: newPerson, error: personError } = await supabase
      .from('people')
      .insert(personToInsert)
      .select('id')
      .single();

    if (personError) throw personError;
    const personId = newPerson.id;

    // 4. Optionally tag the person
    if (form.target_tag_id) {
      await supabase.from('person_tags').insert({
        church_id: churchId,
        person_id: personId,
        tag_id: form.target_tag_id,
      });
    }

    // 5. Add to Workflow directly if target_workflow_id is set
    // Note: If they also get a tag that triggers a workflow, triggerWorkflowsForTags handles deduping
    if (form.target_workflow_id) {
      // Find the first step
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('id, default_days_to_complete')
        .eq('church_id', churchId)
        .eq('workflow_id', form.target_workflow_id)
        .order('order_index', { ascending: true })
        .limit(1);

      if (steps && steps.length > 0) {
        const firstStep = steps[0];
        
        let dueDate = null;
        if (firstStep.default_days_to_complete) {
          const d = new Date();
          d.setDate(d.getDate() + firstStep.default_days_to_complete);
          dueDate = d.toISOString().split('T')[0];
        }

        await supabase.from('workflow_cards').insert({
          church_id: churchId,
          workflow_id: form.target_workflow_id,
          current_step_id: firstStep.id,
          person_id: personId,
          due_date: dueDate,
          notes: `Added automatically via Connect Form: ${slug}`,
        });
      }
    }

    // Fire webhook
    import('@/lib/webhooks').then(m => m.dispatchWebhook(churchId, 'person.created', { id: personId }));

    return NextResponse.json({ success: true, person_id: personId });
  } catch (error: unknown) {
    console.error('Connect form error:', error);
    return NextResponse.json(
      { error: 'An error occurred submitting the form' },
      { status: 500 }
    );
  }
}
