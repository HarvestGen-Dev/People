// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireHgLinkEditor } from '@/lib/hg-link/access';
import { contentSchema } from '@/lib/hg-link/contentSchema';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const supabase = createServiceClient();

    const { data: draft, error: draftError } = await supabase
      .from('hg_link_revisions')
      .select('content')
      .eq('church_id', churchId)
      .eq('status', 'draft')
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft) return NextResponse.json({ error: 'There are no draft changes to publish' }, { status: 409 });

    // Re-validate at publish time: never trust stored JSON blindly.
    const parsed = contentSchema.safeParse(draft.content);
    if (!parsed.success) {
      return NextResponse.json({ error: 'The draft is invalid. Fix it and save again before publishing.' }, { status: 400 });
    }

    // SQL compares this validated snapshot with the locked draft and checks form destinations.
    const { data, error } = await supabase.rpc('hg_link_publish', {
      p_church_id: churchId, p_user_id: user.id, p_expected_content: draft.content,
    });
    if (error) throw error;
    const result = data as { success: boolean; code?: string; version?: number };
    if (!result.success) {
      if (result.code === 'form_not_found') {
        return NextResponse.json({ error: 'Some cards open forms that do not exist or are inactive. Update those cards before publishing.' }, { status: 400 });
      }
      return NextResponse.json({
        error: result.code === 'draft_changed'
          ? 'The draft changed while publishing. Reload the editor and review it before publishing again.'
          : 'There are no draft changes to publish',
      }, { status: 409 });
    }

    await recordAuditLog({
      churchId, actor: user, action: 'hg_link.published', resourceType: 'hg_link_page',
      metadata: { version: result.version ?? null }, request,
    });
    return NextResponse.json({ data: { version: result.version } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
