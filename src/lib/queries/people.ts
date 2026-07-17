import { createServiceClient } from '@/lib/supabase/server';
import type { PersonWithRelations } from '@/lib/types';
import { createRequestPerformanceTracker } from '@/lib/performance';
import { addSignedPhotoUrls } from '@/lib/people/photos';

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
  const perf = createRequestPerformanceTracker('people-query');
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const selectString = filters.tag
    ? `
      id,
      display_id,
      first_name,
      last_name,
      email,
      phone,
      status,
      campus,
      photo_url,
      photo_path,
      created_at,
      updated_at,
      person_tags!person_tags_church_person_fk(tag:tags!person_tags_church_tag_fk(id, name, color)),
      tag_filter:person_tags!inner(tag_id)
    `
    : `
      id,
      display_id,
      first_name,
      last_name,
      email,
      phone,
      status,
      campus,
      photo_url,
      photo_path,
      created_at,
      updated_at,
      person_tags!person_tags_church_person_fk(tag:tags!person_tags_church_tag_fk(id, name, color))
    `;

  let query = supabase
    .from('people')
    .select(selectString, { count: 'exact' })
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

  if (filters.tag) {
    query = query.eq('tag_filter.tag_id', filters.tag);
  }

  const { data, error, count } = await perf.track('people.list', query);
  if (error) throw error;

  perf.log();
  const people = await addSignedPhotoUrls(
    ((data as unknown as PersonWithRelations[]) ?? []),
    filters.church_id
  );

  return { people, total: count ?? 0 };
}
