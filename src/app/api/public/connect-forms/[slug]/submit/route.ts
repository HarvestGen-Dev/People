// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { enforcePublicRateLimit } from '@/lib/public-rate-limit';
import { lookupOrCreatePerson, PersonIdentityConflictError } from '@/lib/people/lookup-or-create';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const connectFormSubmissionSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  birthdate: z.string().date().optional().nullable(),
  campus: z.string().trim().max(100).optional().nullable(),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { slug } = await params;
    const limited = await enforcePublicRateLimit(request, {
      bucket: 'public:connect-form-submit',
      scope: slug,
      limit: 10,
      windowSeconds: 60 * 60,
      error: 'Too many submissions. Please try again later.',
    });
    if (limited) return limited;

    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = connectFormSubmissionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const submission = parsed.data;

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

    const { person, found } = await lookupOrCreatePerson({
      church_id: churchId,
      first_name: submission.first_name,
      last_name: submission.last_name,
      email: submission.email ?? null,
      phone: submission.phone ?? null,
    });
    const personId = person.id;

    const safeUpdates: Record<string, string | null> = {};
    for (const [field, submittedValue] of Object.entries({
      email: submission.email?.toLowerCase() ?? null,
      phone: submission.phone ?? null,
      gender: submission.gender ?? null,
      birthdate: submission.birthdate ?? null,
      campus: submission.campus ?? null,
    })) {
      const existingValue = person[field as keyof typeof person];
      if ((existingValue === null || existingValue === '') && submittedValue) {
        safeUpdates[field] = submittedValue;
      }
    }

    if (Object.keys(safeUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('people')
        .update(safeUpdates)
        .eq('church_id', churchId)
        .eq('id', personId);
      if (updateError) throw updateError;
    }

    // 4. Optionally tag the person
    if (form.target_tag_id) {
      await supabase.from('person_tags').upsert({
        church_id: churchId,
        person_id: personId,
        tag_id: form.target_tag_id,
      }, {
        onConflict: 'person_id,tag_id',
        ignoreDuplicates: true,
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
        const { count: existingCardCount } = await supabase
          .from('workflow_cards')
          .select('id', { count: 'exact', head: true })
          .eq('church_id', churchId)
          .eq('workflow_id', form.target_workflow_id)
          .eq('person_id', personId)
          .is('completed_at', null);

        if (existingCardCount && existingCardCount > 0) {
          return NextResponse.json({ success: true, person_id: personId, found });
        }
        
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
    import('@/lib/webhooks').then(m => m.dispatchWebhook(churchId, found ? 'person.updated' : 'person.created', { id: personId }));

    return NextResponse.json({ success: true, person_id: personId, found });
  } catch (error: unknown) {
    if (error instanceof PersonIdentityConflictError) {
      return NextResponse.json(
        { error: 'This submission needs manual review before it can be matched.' },
        { status: 409 }
      );
    }
    console.error('Connect form error:', error);
    return NextResponse.json(
      { error: 'An error occurred submitting the form' },
      { status: 500 }
    );
  }
}
