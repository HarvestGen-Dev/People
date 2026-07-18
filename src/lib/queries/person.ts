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
      household:households!people_church_household_fk(*),
      person_tags!person_tags_church_person_fk(tag:tags!person_tags_church_tag_fk(*)),
      person_field_values!person_field_values_church_person_fk(*, field_definition:field_definitions!person_field_values_church_field_definition_fk(*))
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
    .select('*, workflows!workflow_cards_church_workflow_fk(name), workflow_steps!workflow_cards_church_current_step_fk(name)')
    .eq('person_id', personId)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  return (data as unknown as WorkflowCardWithRelations[]) || [];
}
