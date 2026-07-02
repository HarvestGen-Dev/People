'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getValidInvitation,
  hashInvitationToken,
} from '@/lib/auth/invitations'
import { resolveAuthenticatedHome } from '@/lib/platform-auth'

type SignUpResult =
  | { success: true; redirectTo?: string }
  | { error: string }
type SelfSignUpResult =
  | { success: true; requiresVerification: boolean; redirectTo?: string }
  | { error: string }

// <!-- AGENT: BACKEND -->
export async function selfSignUpAction(
  email: string,
  password: string
): Promise<SelfSignUpResult> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: 'Enter a valid email address' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  if (data.session && data.user) {
    await supabase.rpc('claim_person_profile')
    return {
      success: true,
      requiresVerification: false,
      redirectTo: await resolveAuthenticatedHome(data.user.id),
    }
  }

  return { success: true, requiresVerification: true }
}

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

  const sessionClient = await createClient()
  const existingSignIn = await sessionClient.auth.signInWithPassword({
    email: invitation.email,
    password,
  })

  if (existingSignIn.data.user) {
    const serviceClient = createServiceClient()
    const { error: acceptanceError } = await serviceClient.rpc(
      'accept_church_invitation',
      {
        p_token_hash: hashInvitationToken(invitationToken),
        p_user_id: existingSignIn.data.user.id,
      }
    )

    if (acceptanceError) {
      return { error: 'Invitation could not be accepted. Please request a new invitation.' }
    }

    return {
      success: true,
      redirectTo: await resolveAuthenticatedHome(existingSignIn.data.user.id),
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await sessionClient.auth.signUp({
    email: invitation.email,
    password,
    options: {
      emailRedirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback?invite=${encodeURIComponent(invitationToken)}`,
      data: {
        // Display/routing metadata only; authorization comes from memberships.
        church_slug: invitation.churchSlug,
      },
    },
  })

  if (error || !data.user) {
    return {
      error:
        error?.message?.toLowerCase().includes('already')
          ? 'An account already exists for this email. Enter its current password to accept the invitation.'
          : error?.message ?? 'Unable to create account',
    }
  }

  if (data.session) {
    const serviceClient = createServiceClient()
    const { error: acceptanceError } = await serviceClient.rpc(
      'accept_church_invitation',
      {
        p_token_hash: hashInvitationToken(invitationToken),
        p_user_id: data.user.id,
      }
    )

    if (acceptanceError) {
      return { error: 'Invitation could not be accepted. Please request a new invitation.' }
    }

    return {
      success: true,
      redirectTo: await resolveAuthenticatedHome(data.user.id),
    }
  }

  return { success: true }
}
