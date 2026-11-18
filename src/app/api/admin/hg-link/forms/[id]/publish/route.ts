// <!-- AGENT: BACKEND -->
// POST: promote the draft definition to the live form and bump its version.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireHgLinkEditor } from '@/lib/hg-link/access';
import { formDefinitionSchema } from '@/lib/hg-link/formSchema';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    const supabase = createServiceClient();
    const { data: form } = await supabase
      .from('connect_forms')
      .select('id, draft_definition, definition_version')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    if (!form.draft_definition) return NextResponse.json({ error: 'There are no draft changes to publish' }, { status: 409 });

    const parsed = formDefinitionSchema.safeParse(form.draft_definition);
    if (!parsed.success) return NextResponse.json({ error: 'The draft is invalid. Fix it and save again.' }, { status: 400 });

    const nextVersion = (form.definition_version ?? 0) + 1;
    // Optimistic concurrency: only publish if nobody else published in the meantime.
    const { data: updated, error } = await supabase
      .from('connect_forms')
      .update({
        definition: parsed.data,
        draft_definition: null,
        definition_version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('church_id', churchId)
      .eq('definition_version', form.definition_version ?? 0)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: 'The form changed while publishing. Reload and try again.' }, { status: 409 });

    await recordAuditLog({
      churchId, actor: user, action: 'hg_link.form_published', resourceType: 'connect_form',
      metadata: { form_id: id, version: nextVersion }, request,
    });
    return NextResponse.json({ data: { version: nextVersion } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
