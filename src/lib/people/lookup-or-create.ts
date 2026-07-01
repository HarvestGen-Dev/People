import { createServiceClient } from '@/lib/supabase/server';
import { PersonWithRelations } from '@/lib/types';

interface LookupParams {
  church_id: string;
  email?: string | null;
  phone?: string | null;
  first_name: string;
  last_name: string;
}

export class PersonIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonIdentityConflictError';
  }
}

export async function lookupOrCreatePerson(params: LookupParams): Promise<{ person: PersonWithRelations; found: boolean }> {
  const supabase = createServiceClient();
  const { church_id, email, phone, first_name, last_name } = params;

  const { data: outcomes, error: lookupError } = await supabase.rpc(
    'lookup_or_create_person',
    {
      p_church_id: church_id,
      p_email: email ?? null,
      p_phone: phone ?? null,
      p_first_name: first_name,
      p_last_name: last_name,
    }
  );

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const outcome = outcomes?.[0];
  if (!outcome) {
    throw new Error('Identity lookup returned no result');
  }

  if (outcome.result_conflict) {
    throw new PersonIdentityConflictError(outcome.result_conflict);
  }

  if (!outcome.result_person_id) {
    throw new Error('Identity lookup returned no person');
  }

  const { data: person, error: personError } = await supabase
    .from('people')
    .select('*')
    .eq('id', outcome.result_person_id)
    .eq('church_id', church_id)
    .single();

  if (personError || !person) {
    throw new Error(personError?.message ?? 'Identity lookup person not found');
  }

  return {
    person: person as PersonWithRelations,
    found: outcome.result_found,
  };
}
