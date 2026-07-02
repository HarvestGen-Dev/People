'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/tenant-context';
import { revalidatePath } from 'next/cache';

export type BulkPersonInput = {
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string;
  campus?: string;
  allow_self_claim?: boolean | string;
};

export async function bulkCreatePeople(people: BulkPersonInput[]) {
  const tenant = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

  // Basic sanitization
  const inserts = people.map(p => ({
    church_id: tenant.churchId,
    first_name: p.first_name || p.firstName,
    last_name: p.last_name || p.lastName,
    email: p.email?.trim().toLowerCase() || null,
    phone: p.phone?.trim() || null,
    status: p.status || 'visitor',
    campus: p.campus || 'Bandar Sunway',
    allow_self_claim:
      !!p.email &&
      p.allow_self_claim !== false &&
      String(p.allow_self_claim).toLowerCase() !== 'false',
  })).filter(p => p.first_name && p.last_name); // First and last name required

  if (inserts.length === 0) {
    return { error: 'No valid people found in CSV. Make sure first_name and last_name are present.' };
  }

  const { data, error } = await supabase
    .from('people')
    .upsert(inserts, {
      onConflict: 'church_id,email',
      ignoreDuplicates: false,
    })
    .select('id');

  if (error) {
    console.error('Error during bulk insert:', error);
    return { error: `Import failed: ${error.message}` };
  }

  revalidatePath('/people');
  return { success: true, count: data?.length || 0 };
}
