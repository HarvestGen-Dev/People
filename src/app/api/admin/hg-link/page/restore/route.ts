// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireHgLinkEditor } from '@/lib/hg-link/access';
import { contentSchema } from '@/lib/hg-link/contentSchema';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireHgLinkEditor();
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = z.object({ revisionId: z.string().uuid() }).strict().safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const supabase = createServiceClient();
    const { data: revision, error: revisionError } = await supabase
      .from('hg_link_revisions')
      .select('content')
      .eq('id', parsed.data.revisionId)
      .eq('church_id', churchId)
      .in('status', ['published', 'archived'])
      .maybeSingle();
    if (revisionError) throw revisionError;
    if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    if (!contentSchema.safeParse(revision.content).success) {
      return NextResponse.json({ error: 'This revision is invalid and cannot be restored.' }, { status: 400 });
    }
    // The SQL function re-checks that the revision belongs to this church.
    const { data, error } = await supabase.rpc('hg_link_restore', {
      p_church_id: churchId,
      p_revision_id: parsed.data.revisionId,
      p_user_id: user.id,
    });
    if (error) throw error;
    const result = data as { success: boolean; code?: string; version?: number; restored_from?: number };
    if (!result.success && result.code === 'form_not_found') {
      return NextResponse.json({ error: 'This revision opens forms that do not exist or are inactive. Reactivate the forms before restoring.' }, { status: 400 });
    }
    if (!result.success) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });

    await recordAuditLog({
      churchId, actor: user, action: 'hg_link.restored', resourceType: 'hg_link_page',
      metadata: { version: result.version ?? null, restored_from: result.restored_from ?? null }, request,
    });
    return NextResponse.json({ data: { version: result.version } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
