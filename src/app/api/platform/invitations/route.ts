// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createChurchInvitation } from '@/lib/auth/create-invitation';
import { adminApiError } from '@/lib/tenant-context';
import { requirePlatformAdmin } from '@/lib/platform-auth';

export async function POST(request: Request) {
  try {
    const { user } = await requirePlatformAdmin();
    const body = (await request.json()) as {
      church_id?: string;
      email?: string;
      expires_in_days?: number;
    };
    const email = body.email?.trim().toLowerCase();
    const expiresInDays = body.expires_in_days ?? 7;

    if (!body.church_id || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'A church and valid email are required' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
      return NextResponse.json(
        { error: 'expires_in_days must be an integer from 1 to 30' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const { data: church, error: churchError } = await serviceClient
      .from('churches')
      .select('id, name')
      .eq('id', body.church_id)
      .maybeSingle();

    if (churchError) throw churchError;
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const appUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin);
    const result = await createChurchInvitation({
      churchId: church.id,
      churchName: church.name,
      email,
      role: 'owner',
      expiresInDays,
      invitedBy: user.id,
      appUrl,
    });

    await serviceClient.from('platform_audit_log').insert({
      actor_id: user.id,
      church_id: church.id,
      action: 'owner.invited',
      target_type: 'church_invitation',
      target_id: result.invitation.id,
      metadata: { email },
    });

    return NextResponse.json(
      {
        data: {
          invitation: result.invitation,
          invite_url: result.inviteUrl,
          email_sent: result.emailSent,
          email_error: result.emailError,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'ALREADY_INVITED'
    ) {
      return NextResponse.json({ 
        error: error.message, 
        code: 'ALREADY_INVITED', 
        existingId: (error as Error & { existingId?: string }).existingId 
      }, { status: 409 });
    }
    return adminApiError(error);
  }
}
