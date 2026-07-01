'use server'

import { createServiceClient } from '@/lib/supabase/server'
import {
  getValidInvitation,
  hashInvitationToken,
} from '@/lib/auth/invitations'

type SignUpResult = { success: true } | { error: string }

// <!-- AGENT: BACKEND -->
export async function signUpAction(
  invitationToken: string,
  password: string
): Promise<SignUpResult> {
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const invitation = await getValidInvitation(invitationToken)
  if (!invitation) {
    return { error: 'Invitation is invalid or has expired' }
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: {
      // Transitional display/routing metadata only. Authorization is determined
      // by church_memberships.
      church_slug: invitation.churchSlug,
    }
  })

  if (error || !data.user) {
    return { error: error?.message ?? 'Unable to create account' }
  }

  const { error: acceptanceError } = await supabase.rpc(
    'accept_church_invitation',
    {
      p_token_hash: hashInvitationToken(invitationToken),
      p_user_id: data.user.id,
    }
  )

  if (acceptanceError) {
    await supabase.auth.admin.deleteUser(data.user.id)
    return { error: 'Invitation could not be accepted. Please request a new invitation.' }
  }

  return { success: true }
}
