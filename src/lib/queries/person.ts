import { createServiceClient } from '@/lib/supabase/server';
import type {
  PersonWithRelations,
  Note,
  PersonEvent,
  WorkflowCardWithRelations,
} from '@/lib/types';
import { applyDisplayOrDatabaseIdFilter } from '@/lib/display-ids';
import { createPeoplePhotoSignedUrl } from '@/lib/people/photos';

export async function getPersonById(
  id: string,
  churchId: string
): Promise<PersonWithRelations | null> {
  const supabase = createServiceClient();
  const query = supabase
    .from('people')
    .select(`
      *,
      household:households(*),
      person_tags(tag:tags(*)),
      person_field_values(*, field_definition:field_definitions(*))
    `)
    .eq('church_id', churchId);

  const { data, error } = await applyDisplayOrDatabaseIdFilter(query, id)
    .single();

  if (error || !data) return null;
  const person = data as PersonWithRelations;
  const signed = await createPeoplePhotoSignedUrl(person, churchId);
  return { ...person, photo_signed_url: signed.signedUrl };
}

export async function getPersonNotes(
  personId: string,
  churchId: string
): Promise<Note[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('person_id', personId)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  return (data as Note[]) || [];
}

export async function getPersonEvents(
  personId: string,
  churchId: string,
  limit: number = 20
): Promise<PersonEvent[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('person_events')
    .select('*')
    .eq('person_id', personId)
    .eq('church_id', churchId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  return (data as PersonEvent[]) || [];
}

export async function getPersonWorkflowCards(
  personId: string,
  churchId: string
): Promise<WorkflowCardWithRelations[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('workflow_cards')
    .select('*, workflows(name), workflow_steps(name)')
    .eq('person_id', personId)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  return (data as unknown as WorkflowCardWithRelations[]) || [];
}
