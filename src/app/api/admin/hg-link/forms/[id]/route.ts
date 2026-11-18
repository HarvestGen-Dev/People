// <!-- AGENT: BACKEND -->
// PUT: save form settings and a DRAFT definition. Public form is unchanged until publish.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireHgLinkEditor } from '@/lib/hg-link/access';
import { formDefinitionSchema } from '@/lib/hg-link/formSchema';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(''),
  isActive: z.boolean(),
  targetTagId: z.string().uuid().nullable(),
  targetWorkflowId: z.string().uuid().nullable(),
  notifyEmail: z.string().trim().email().max(255).nullable(),
  definition: formDefinitionSchema,
}).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const input = parsed.data;

    const supabase = createServiceClient();
    const { data: form } = await supabase
      .from('connect_forms')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    // Tag and workflow targets must belong to this church.
    if (input.targetTagId) {
      const { data } = await supabase.from('tags').select('id').eq('id', input.targetTagId).eq('church_id', churchId).maybeSingle();
      if (!data) return NextResponse.json({ error: 'Choose a tag from this church' }, { status: 400 });
    }
    if (input.targetWorkflowId) {
      const { data } = await supabase.from('workflows').select('id').eq('id', input.targetWorkflowId).eq('church_id', churchId).maybeSingle();
      if (!data) return NextResponse.json({ error: 'Choose a workflow from this church' }, { status: 400 });
    }

    const { error } = await supabase
      .from('connect_forms')
      .update({
        title: input.title,
        description: input.description,
        is_active: input.isActive,
        target_tag_id: input.targetTagId,
        target_workflow_id: input.targetWorkflowId,
        notify_email: input.notifyEmail,
        draft_definition: input.definition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('church_id', churchId);
    if (error) throw error;

    await recordAuditLog({ churchId, actor: user, action: 'hg_link.form_draft_saved', resourceType: 'connect_form', metadata: { form_id: id }, request });
    return NextResponse.json({ data: { saved: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('connect_forms')
      .update({ draft_definition: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    await recordAuditLog({ churchId, actor: user, action: 'hg_link.form_draft_discarded', resourceType: 'connect_form', metadata: { form_id: id }, request });
    return NextResponse.json({ data: { discarded: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
