import { createServiceClient } from '@/lib/supabase/server';
import { PersonWithRelations } from '@/lib/types';

interface LookupParams {
  church_id: string;
  email?: string | null;
  phone?: string | null;
  first_name: string;
  last_name: string;
  source: string;
}

export async function lookupOrCreatePerson(params: LookupParams): Promise<{ person: PersonWithRelations; found: boolean }> {
  const supabase = createServiceClient();
  const { church_id, email, phone, first_name, last_name, source } = params;

  let query = supabase.from('people').select('*').eq('church_id', church_id);
  
  if (email && phone) {
    query = query.or(`email.eq.${email},phone.eq.${phone}`);
  } else if (email) {
    query = query.eq('email', email);
  } else if (phone) {
    query = query.eq('phone', phone);
  } else {
    // Cannot lookup without email or phone, so just create
  }

  if (email || phone) {
    const { data: existing } = await query.limit(1);
    if (existing && existing.length > 0) {
      return { person: existing[0] as PersonWithRelations, found: true };
    }
  }

  // Not found, create as visitor
  const { data: newPerson, error: insertError } = await supabase
    .from('people')
    .insert({
      church_id,
      first_name,
      last_name,
      email: email || null,
      phone: phone || null,
      status: 'visitor',
      campus: 'Bandar Sunway',
    })
    .select('*')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { person: newPerson as PersonWithRelations, found: false };
}
