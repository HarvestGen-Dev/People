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

    const { data: draft } = await supabase
      .from('hg_link_revisions')
      .select('content')
      .eq('church_id', churchId)
      .eq('status', 'draft')
      .maybeSingle();
    if (!draft) return NextResponse.json({ error: 'There are no draft changes to publish' }, { status: 409 });

    // Re-validate at publish time: never trust stored JSON blindly.
    const parsed = contentSchema.safeParse(draft.content);
    if (!parsed.success) {
      return NextResponse.json({ error: 'The draft is invalid. Fix it and save again before publishing.' }, { status: 400 });
    }

    // Every visible internal card must point at an active form in THIS church.
    const slugs = parsed.data.cards
      .filter((c) => c.visible && c.destination.type === 'form')
      .map((c) => (c.destination.type === 'form' ? c.destination.formSlug : ''));
    if (slugs.length > 0) {
      const { data: forms, error } = await supabase
        .from('connect_forms')
        .select('slug')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .in('slug', slugs);
      if (error) throw error;
      const found = new Set((forms ?? []).map((f) => f.slug as string));
      const missing = [...new Set(slugs.filter((s) => !found.has(s)))];
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `These cards open forms that do not exist or are inactive: ${missing.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase.rpc('hg_link_publish', { p_church_id: churchId, p_user_id: user.id });
    if (error) throw error;
    const result = data as { success: boolean; code?: string; version?: number };
    if (!result.success) return NextResponse.json({ error: 'There are no draft changes to publish' }, { status: 409 });

    await recordAuditLog({
      churchId, actor: user, action: 'hg_link.published', resourceType: 'hg_link_page',
      metadata: { version: result.version ?? null }, request,
    });
    return NextResponse.json({ data: { version: result.version } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
