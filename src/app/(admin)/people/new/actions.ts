'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPerson(formData: FormData) {
  const supabase = await createClient();

  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const status = formData.get('status') as string;
  const campus = formData.get('campus') as string;

  if (!firstName || !lastName) {
    return { error: 'First name and last name are required.' };
  }

  const { data, error } = await supabase
    .from('people')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      status: status || 'visitor',
      campus: campus || 'Bandar Sunway',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating person:', error);
    if (error.code === '23505') {
      return { error: 'A person with this email already exists.' };
    }
    return { error: 'Failed to create person. Please try again.' };
  }

  revalidatePath('/people');
  redirect(`/people/${data.id}`);
}
