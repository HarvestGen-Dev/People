import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { resolveAuthenticatedHome } from '@/lib/platform-auth';
import { getValidInvitation, hashInvitationToken } from '@/lib/auth/invitations';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const invitationToken = searchParams.get('invite');
  
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) {
      if (invitationToken && (await getValidInvitation(invitationToken))) {
        const serviceClient = createServiceClient();
        const { error: acceptanceError } = await serviceClient.rpc(
          'accept_church_invitation',
          {
            p_token_hash: hashInvitationToken(invitationToken),
            p_user_id: data.user.id,
          }
        );
        if (acceptanceError) {
          return NextResponse.redirect(`${origin}/claim-pending`);
        }
      }
      await supabase.rpc('claim_person_profile');
      return NextResponse.redirect(
        `${origin}${await resolveAuthenticatedHome(data.user.id)}`
      );
    }
  }
  
  return NextResponse.redirect(`${origin}/login`);
}
