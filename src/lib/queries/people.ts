import { createServiceClient } from '@/lib/supabase/server';
import type { ListTag, Person } from '@/lib/types';

export type PeopleFilters = {
  church_id: string;
  search?: string;
  status?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
};

export type PeopleDirectoryPerson = Pick<
  Person,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'status'
  | 'campus'
  | 'photo_url'
  | 'created_at'
  | 'updated_at'
> & {
  person_tags?: Array<{ tag: ListTag | null }>;
};

type RawPeopleDirectoryPerson = Omit<PeopleDirectoryPerson, 'person_tags'> & {
  person_tags?: Array<{ tag: ListTag | ListTag[] | null }>;
};

export async function getPeople(filters: PeopleFilters): Promise<{
  people: PeopleDirectoryPerson[];
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
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      campus,
      photo_url,
      created_at,
      updated_at,
      person_tags(tag:tags(id, name, color))
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

  const people = ((data ?? []) as unknown as RawPeopleDirectoryPerson[]).map(
    (person) => ({
      ...person,
      person_tags: person.person_tags?.map((personTag) => ({
        tag: Array.isArray(personTag.tag)
          ? personTag.tag[0] ?? null
          : personTag.tag,
      })),
    })
  );

  return { people, total: count ?? 0 };
}
