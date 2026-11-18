// <!-- AGENT: BACKEND -->
// GET draft/published state, PUT save draft, DELETE discard draft. Owner/admin only.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireHgLinkEditor } from '@/lib/hg-link/access';
import { contentSchema } from '@/lib/hg-link/contentSchema';
import { loadAdminState } from '@/lib/hg-link/content';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

export async function GET() {
  try {
    const { churchId } = await requireHgLinkEditor();
    return NextResponse.json({ data: await loadAdminState(churchId) });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = z.object({ content: contentSchema }).strict().safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const supabase = createServiceClient();
    const { error } = await supabase.rpc('hg_link_save_draft', {
      p_church_id: churchId,
      p_content: parsed.data.content,
      p_user_id: user.id,
    });
    if (error) throw error;
    await recordAuditLog({ churchId, actor: user, action: 'hg_link.draft_saved', resourceType: 'hg_link_page', request });
    return NextResponse.json({ data: { saved: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('hg_link_revisions')
      .delete()
      .eq('church_id', churchId)
      .eq('status', 'draft');
    if (error) throw error;
    await recordAuditLog({ churchId, actor: user, action: 'hg_link.draft_discarded', resourceType: 'hg_link_page', request });
    return NextResponse.json({ data: { discarded: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
