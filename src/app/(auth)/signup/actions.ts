'use server'

import { headers } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getValidInvitation,
  hashInvitationToken,
} from '@/lib/auth/invitations'
import { resolveAuthenticatedHome } from '@/lib/platform-auth'

type SignUpResult =
  | { success: true; redirectTo?: string }
  | { error: string }
type InvitedProfileInput = {
  firstName: string
  lastName: string
  phone?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  birthdate?: string
}
type SelfSignUpResult =
  | { success: true; requiresVerification: boolean; redirectTo?: string }
  | { error: string }

async function getAppUrl(): Promise<string> {
  const requestHeaders = await headers()
  const host = (
    requestHeaders.get('x-forwarded-host') ??
    requestHeaders.get('host')
  )?.split(',')[0]?.trim()

  if (!host) {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    return configuredUrl ? configuredUrl.replace(/\/$/, '') : 'http://localhost:3000'
  }

  const forwardedProtocol = requestHeaders
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  const protocol =
    forwardedProtocol ?? (host.startsWith('localhost') ? 'http' : 'https')

  return `${protocol}://${host}`
}

function validateInvitedProfile(
  profile: InvitedProfileInput
): string | null {
  if (!profile.firstName.trim() || !profile.lastName.trim()) {
    return 'First name and last name are required'
  }
  if (
    profile.firstName.trim().length > 100 ||
    profile.lastName.trim().length > 100
  ) {
    return 'First name and last name must be 100 characters or fewer'
  }
  if (profile.phone && profile.phone.trim().length > 50) {
    return 'Phone number must be 50 characters or fewer'
  }
  if (profile.birthdate) {
    const birthdate = new Date(`${profile.birthdate}T00:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthdate) ||
      Number.isNaN(birthdate.getTime()) ||
      birthdate > new Date()
    ) {
      return 'Enter a valid birthdate'
    }
  }
  return null
}

async function createInvitedPersonProfile(
  invitationToken: string,
  userId: string,
  profile: InvitedProfileInput
): Promise<string | null> {
  const serviceClient = createServiceClient()
  const { error } = await serviceClient.rpc('create_invited_person_profile', {
    p_token_hash: hashInvitationToken(invitationToken),
    p_user_id: userId,
    p_first_name: profile.firstName.trim(),
    p_last_name: profile.lastName.trim(),
    p_phone: profile.phone?.trim() || null,
    p_gender: profile.gender || null,
    p_birthdate: profile.birthdate || null,
  })

  return error?.message ?? null
}

async function clearExistingSession(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.auth.signOut()
  }
}

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
  await clearExistingSession(supabase)
  const appUrl = await getAppUrl()
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
  password: string,
  profile: InvitedProfileInput
): Promise<SignUpResult> {
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }
  const profileError = validateInvitedProfile(profile)
  if (profileError) {
    return { error: profileError }
  }

  const invitation = await getValidInvitation(invitationToken)
  if (!invitation) {
    return { error: 'Invitation is invalid or has expired' }
  }

  const sessionClient = await createClient()
  await clearExistingSession(sessionClient)
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

    const personError = await createInvitedPersonProfile(
      invitationToken,
      existingSignIn.data.user.id,
      profile
    )
    if (personError) {
      return { error: `Your profile could not be created: ${personError}` }
    }

    return {
      success: true,
      redirectTo: await resolveAuthenticatedHome(existingSignIn.data.user.id),
    }
  }

  const appUrl = await getAppUrl()
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

  const personError = await createInvitedPersonProfile(
    invitationToken,
    data.user.id,
    profile
  )
  if (personError) {
    return { error: `Your profile could not be created: ${personError}` }
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
