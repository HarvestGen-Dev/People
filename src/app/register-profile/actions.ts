'use server';

// <!-- AGENT: BACKEND -->
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { lookupOrCreatePerson } from '@/lib/people/lookup-or-create';
// Removed redirect

export async function registerProfileAction(formData: FormData) {
  const churchCode = formData.get('churchCode') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const phone = formData.get('phone') as string;

  if (!churchCode || !firstName || !lastName) {
    return { error: 'Church code, first name, and last name are required.' };
  }

  const supabase = await createClient();
  const serviceClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: 'You must be logged in with a verified email to register a profile.' };
  }

  const { data: church, error: churchError } = await serviceClient
    .from('churches')
    .select('id')
    .eq('slug', churchCode.trim().toLowerCase())
    .maybeSingle();

  if (churchError || !church) {
    return { error: 'Invalid church code. Please check with your administrator.' };
  }

  try {
    const { person } = await lookupOrCreatePerson({
      church_id: church.id,
      email: user.email,
      phone: phone || null,
      first_name: firstName,
      last_name: lastName,
    });

    const { error: linkError } = await serviceClient
      .from('person_user_links')
      .insert({
        church_id: church.id,
        person_id: person.id,
        user_id: user.id,
        claim_method: 'verified_email',
      });

    if (linkError) {
      if (linkError.code === '23505') {
        return { error: 'This profile is already linked to an account. If this is a mistake, please contact your administrator.' };
      }
      return { error: 'Failed to link profile to your account.' };
    }

    // Grant member permission so they can access the dashboard directly
    const { error: membershipError } = await serviceClient
      .from('church_memberships')
      .insert({
        church_id: church.id,
        user_id: user.id,
        role: 'member',
      })
      .select()
      .maybeSingle();

    if (membershipError && membershipError.code !== '23505') {
      console.error('Failed to grant dashboard access:', membershipError);
      // We don't hard fail here since the profile is created, but they might not have dashboard access.
    }

  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'An error occurred while creating your profile.' };
  }

  return { redirectTo: '/dashboard' };
}
