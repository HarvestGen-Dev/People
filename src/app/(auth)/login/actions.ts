'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveAuthenticatedHome } from '@/lib/platform-auth'

export async function loginWithPasswordAction(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  await supabase.rpc('claim_person_profile')
  return {
    success: true,
    redirectTo: await resolveAuthenticatedHome(data.user.id),
  }
}
