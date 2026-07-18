import { createServiceClient } from '@/lib/supabase/server';
import type { PersonTag, PersonWithRelations, Tag } from '@/lib/types';
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

  let taggedPersonIds: string[] | null = null;
  if (filters.tag) {
    const { data: tagRows, error: tagError } = await perf.track(
      'people.tag_filter',
      supabase
        .from('person_tags')
        .select('person_id')
        .eq('church_id', filters.church_id)
        .eq('tag_id', filters.tag)
    );
    if (tagError) throw tagError;
    taggedPersonIds = [...new Set((tagRows ?? []).map((row) => row.person_id))];
    if (taggedPersonIds.length === 0) {
      return { people: [], total: 0 };
    }
  }

  let query = supabase
    .from('people')
    .select(`
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
      updated_at
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

  if (taggedPersonIds) {
    query = query.in('id', taggedPersonIds);
  }

  const { data, error, count } = await perf.track('people.list', query);
  if (error) throw error;

  const peopleRows = (data as unknown as PersonWithRelations[]) ?? [];
  const peopleIds = peopleRows.map((person) => person.id);
  const personTagsByPersonId = new Map<string, PersonTag[]>();

  if (peopleIds.length > 0) {
    const { data: personTagRows, error: personTagError } = await perf.track(
      'people.tags_for_page',
      supabase
        .from('person_tags')
        .select('person_id, tag_id, created_at')
        .eq('church_id', filters.church_id)
        .in('person_id', peopleIds)
    );
    if (personTagError) throw personTagError;

    const tagIds = [...new Set((personTagRows ?? []).map((row) => row.tag_id))];
    const tagsById = new Map<string, Tag>();

    if (tagIds.length > 0) {
      const { data: tagRows, error: tagsError } = await perf.track(
        'people.tag_details_for_page',
        supabase
          .from('tags')
          .select('id, display_id, name, color, target_workflow_id, created_at')
          .eq('church_id', filters.church_id)
          .in('id', tagIds)
      );
      if (tagsError) throw tagsError;
      for (const tag of (tagRows as Tag[] | null) ?? []) {
        tagsById.set(tag.id, tag);
      }
    }

    for (const row of personTagRows ?? []) {
      const tag = tagsById.get(row.tag_id);
      if (!tag) continue;
      const tags = personTagsByPersonId.get(row.person_id) ?? [];
      tags.push({
        person_id: row.person_id,
        tag_id: row.tag_id,
        created_at: row.created_at,
        tag,
      });
      personTagsByPersonId.set(row.person_id, tags);
    }
  }

  perf.log();
  const people = await addSignedPhotoUrls(
    peopleRows.map((person) => ({
      ...person,
      person_tags: personTagsByPersonId.get(person.id) ?? [],
    })),
    filters.church_id
  );

  return { people, total: count ?? 0 };
}
