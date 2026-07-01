// <!-- AGENT: BACKEND -->
import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { getChurchTeam } from '@/lib/team';

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

    const serviceClient = createServiceClient();
    if (role === 'admin' && tenant.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only church owners can invite administrators' },
        { status: 403 }
      );
    }

    const { data: existingInvitation, error: existingInvitationError } =
      await serviceClient
        .from('church_invitations')
        .select('id')
        .eq('church_id', tenant.churchId)
        .eq('email', email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

    if (existingInvitationError) throw existingInvitationError;
    if (existingInvitation) {
      return NextResponse.json(
        { error: 'A valid pending invitation already exists for this email' },
        { status: 409 }
      );
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: invitation, error: invitationError } = await serviceClient
      .from('church_invitations')
      .insert({
        church_id: tenant.churchId,
        email,
        token_hash: tokenHash,
        role,
        invited_by: tenant.user.id,
        expires_at: expiresAt,
      })
      .select('id, church_id, email, role, expires_at, created_at')
      .single();

    if (invitationError) throw invitationError;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const inviteUrl = `${appUrl.replace(/\/$/, '')}/signup?invite=${encodeURIComponent(rawToken)}`;

    return NextResponse.json(
      { data: { invitation, invite_url: inviteUrl } },
      { status: 201 }
    );
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
