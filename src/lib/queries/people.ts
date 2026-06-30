import { createServiceClient } from '@/lib/supabase/server';
import type { PersonWithRelations } from '@/lib/types';

export type PeopleFilters = {
  church_id: string;
  search?: string;
  status?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
};

export async function getPeople(filters: PeopleFilters): Promise<{
  people: PersonWithRelations[];
  total: number;
}> {
  const supabase = createServiceClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('people')
    .select(`
      *,
      household:households(*),
      person_tags(tag:tags(*))
    `, { count: 'exact' })
    .eq('church_id', filters.church_id)
    .order('last_name', { ascending: true })
    .range(from, to);

  if (filters.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  // Tag filter: fetch person_ids with this tag first
  if (filters.tag) {
    const { data: taggedPeople } = await supabase
      .from('person_tags')
      .select('person_id')
      .eq('church_id', filters.church_id)
      .eq('tag_id', filters.tag);
    
    const ids = (taggedPeople ?? []).map(r => r.person_id);
    if (ids.length === 0) return { people: [], total: 0 };
    query = query.in('id', ids);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  
  return { people: (data as PersonWithRelations[]) ?? [], total: count ?? 0 };
}
