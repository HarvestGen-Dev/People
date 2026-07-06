// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { getChurchTeam } from '@/lib/team';
import { createChurchInvitation } from '@/lib/auth/create-invitation';

type CreateInvitationBody = {
  church_id?: string;
  email?: string;
  role?: 'admin' | 'member';
  expires_in_days?: number;
};

export async function GET() {
  try {
    const tenant = await requireTenantContext({ requireManager: true });
    const data = await getChurchTeam(tenant.churchId);
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateInvitationBody;
    const tenant = await requireTenantContext({
      churchId: body.church_id,
      requireManager: true,
    });
    const email = body.email?.trim().toLowerCase();
    const role = body.role ?? 'member';
    const expiresInDays = body.expires_in_days ?? 7;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'A valid email is required' },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json(
        { error: 'Role must be admin or member' },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(expiresInDays) ||
      expiresInDays < 1 ||
      expiresInDays > 30
    ) {
      return NextResponse.json(
        { error: 'expires_in_days must be an integer from 1 to 30' },
        { status: 400 }
      );
    }

    if (role === 'admin' && tenant.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only church owners can invite administrators' },
        { status: 403 }
      );
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const appUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin);
    const result = await createChurchInvitation({
      churchId: tenant.churchId,
      churchName: tenant.churchName,
      email,
      role,
      expiresInDays,
      invitedBy: tenant.user.id,
      appUrl,
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
