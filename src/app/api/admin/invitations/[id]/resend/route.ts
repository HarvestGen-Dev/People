// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createChurchInvitation } from '@/lib/auth/create-invitation';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError, requireTenantContext } from '@/lib/tenant-context';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenantContext({ requireManager: true });
    const { id } = await context.params;
    const serviceClient = createServiceClient();
    const { data: existing, error: lookupError } = await serviceClient
      .from('church_invitations')
      .select('id, email, role')
      .eq('id', id)
      .eq('church_id', tenant.churchId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) {
      return NextResponse.json({ error: 'Pending invitation not found' }, { status: 404 });
    }
    if (existing.role === 'owner' && !tenant.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Only platform administrators can resend owner invitations' },
        { status: 403 }
      );
    }

    if (existing.role === 'admin' && tenant.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only church owners can resend administrator invitations' },
        { status: 403 }
      );
    }

    const { error: revokeError } = await serviceClient
      .from('church_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (revokeError) throw revokeError;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const result = await createChurchInvitation({
      churchId: tenant.churchId,
      churchName: tenant.churchName,
      email: existing.email,
      role: existing.role,
      expiresInDays: 7,
      invitedBy: tenant.user.id,
      appUrl,
    });

    return NextResponse.json({
      data: {
        invitation: result.invitation,
        invite_url: result.inviteUrl,
        email_sent: result.emailSent,
        email_error: result.emailError,
      },
    });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
