// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const reviewSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  resolution_note: z.string().trim().max(1000).optional().nullable(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { churchId, user } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();
    const { id } = await params;
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const { data, error } = await supabase.rpc('review_person_proposed_update', {
      p_church_id: churchId,
      p_proposal_id: id,
      p_decision: parsed.data.decision,
      p_resolution_note: parsed.data.resolution_note ?? null,
    });

    if (error) {
      if (error.message.includes('proposal_not_found')) {
        return NextResponse.json({ error: 'Proposed update not found' }, { status: 404 });
      }
      throw error;
    }

    await recordAuditLog({
      churchId,
      actor: user,
      action: `person_proposed_update.${parsed.data.decision}`,
      resourceType: 'person_proposed_update',
      resourceDisplayId: id,
      metadata: {
        decision: parsed.data.decision,
      },
      request,
    });

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
