// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError, requireTenantContext } from '@/lib/tenant-context';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenantContext({ requireManager: true });
    const { id } = await context.params;
    const serviceClient = createServiceClient();

    const { data: invitation, error: lookupError } = await serviceClient
      .from('church_invitations')
      .select('id, role')
      .eq('id', id)
      .eq('church_id', tenant.churchId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!invitation) {
      return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
    }

    if (invitation.role === 'owner' && !tenant.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Only platform administrators can revoke owner invitations' },
        { status: 403 }
      );
    }

    if (invitation.role === 'admin' && tenant.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only church owners can revoke administrator invitations' },
        { status: 403 }
      );
    }

    const { error } = await serviceClient
      .from('church_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('church_id', tenant.churchId);

    if (error) throw error;
    return NextResponse.json({ data: { id } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
