'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function bulkCreatePeople(people: any[]) {
  const supabase = await createClient();

  // Basic sanitization
  const inserts = people.map(p => ({
    first_name: p.first_name || p.firstName,
    last_name: p.last_name || p.lastName,
    email: p.email || null,
    phone: p.phone || null,
    status: p.status || 'visitor',
    campus: p.campus || 'Bandar Sunway'
  })).filter(p => p.first_name && p.last_name); // First and last name required

  if (inserts.length === 0) {
    return { error: 'No valid people found in CSV. Make sure first_name and last_name are present.' };
  }

  const { data, error } = await supabase
    .from('people')
    .insert(inserts)
    .select('id');

  if (error) {
    console.error('Error during bulk insert:', error);
    return { error: 'Failed to import some records. They might have duplicate emails.' };
  }

  revalidatePath('/people');
  return { success: true, count: data?.length || 0 };
}
