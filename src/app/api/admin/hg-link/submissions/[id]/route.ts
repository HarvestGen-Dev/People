// <!-- AGENT: BACKEND -->
// PATCH: update follow-up status / assignee. owner, admin, pastoral, workflow_manager only.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertSameOrigin, requireSubmissionAccess } from '@/lib/hg-link/access';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const patchSchema = z.object({
  status: z.enum(['new', 'contacted', 'in_progress', 'completed']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
}).strict().refine((v) => v.status !== undefined || v.assignedTo !== undefined, { message: 'Nothing to update' });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { churchId, user } = await requireSubmissionAccess();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const input = parsed.data;

    const supabase = createServiceClient();
    const { data: submission } = await supabase
      .from('connect_form_submissions')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();
    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const update: Record<string, string | null> = {};
    if (input.assignedTo !== undefined) {
      if (input.assignedTo) {
        // Assignee must be a member of THIS church with submission access.
        const { data: member } = await supabase
          .from('church_memberships')
          .select('role')
          .eq('church_id', churchId)
          .eq('user_id', input.assignedTo)
          .maybeSingle();
        if (!member || !['owner', 'admin', 'pastoral', 'workflow_manager'].includes(member.role as string)) {
          return NextResponse.json({ error: 'Assign to a team member who can follow up' }, { status: 400 });
        }
      }
      update.assigned_to = input.assignedTo;
    }
    if (input.status !== undefined) update.follow_up_status = input.status;
    update.status_updated_at = new Date().toISOString();
    update.status_updated_by = user.id;

    const { error } = await supabase
      .from('connect_form_submissions')
      .update(update)
      .eq('id', id)
      .eq('church_id', churchId);
    if (error) throw error;

    await recordAuditLog({
      churchId, actor: user, action: 'hg_link.submission_updated', resourceType: 'connect_form_submission',
      metadata: { submission_id: id, status: input.status ?? null, assigned_to: input.assignedTo ?? null }, request,
    });
    return NextResponse.json({ data: { updated: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
