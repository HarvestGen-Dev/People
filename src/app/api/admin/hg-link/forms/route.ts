// <!-- AGENT: BACKEND -->
// POST: create the four standard HG Link forms for this church (idempotent).
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireHgLinkEditor } from '@/lib/hg-link/access';
import { defaultFormSeeds } from '@/lib/hg-link/formSchema';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const supabase = createServiceClient();

    const { data: existing, error: existingError } = await supabase
      .from('connect_forms')
      .select('id, slug, definition')
      .eq('church_id', churchId);
    if (existingError) throw existingError;
    const bySlug = new Map((existing ?? []).map((f) => [f.slug as string, f]));

    const created: string[] = [];
    for (const seed of defaultFormSeeds()) {
      const current = bySlug.get(seed.slug);
      if (current) continue; // never overwrite a form that already exists
      const { error } = await supabase.from('connect_forms').insert({
        church_id: churchId,
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        kind: seed.kind,
        definition: seed.definition,
        draft_definition: null,
        definition_version: 1,
        is_active: true,
        created_by: user.id,
      });
      if (error) throw error;
      created.push(seed.slug);
    }

    if (created.length > 0) {
      await recordAuditLog({
        churchId, actor: user, action: 'hg_link.forms_created', resourceType: 'connect_form',
        metadata: { slugs: created }, request,
      });
    }
    return NextResponse.json({ data: { created } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
