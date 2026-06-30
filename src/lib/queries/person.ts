import { createServiceClient } from '@/lib/supabase/server';
import type { PersonWithRelations, Note, PersonEvent, WorkflowCard } from '@/lib/types';

export async function getPersonById(id: string): Promise<PersonWithRelations | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('people')
    .select(`
      *,
      household:households(*),
      person_tags(tag:tags(*)),
      person_field_values(*, field_definition:field_definitions(*))
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as PersonWithRelations;
}

export async function getPersonNotes(personId: string): Promise<Note[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false });

  return (data as Note[]) || [];
}

export async function getPersonEvents(personId: string, limit: number = 20): Promise<PersonEvent[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('person_events')
    .select('*')
    .eq('person_id', personId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  return (data as PersonEvent[]) || [];
}

export async function getPersonWorkflowCards(personId: string): Promise<WorkflowCard[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('workflow_cards')
    .select('*, workflows(name), workflow_steps(name)')
    .eq('person_id', personId)
    .order('created_at', { ascending: false });

  return (data as any[]) || [];
}
