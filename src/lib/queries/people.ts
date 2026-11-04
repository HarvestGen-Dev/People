// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import type { PersonTag, PersonWithRelations } from '@/lib/types';
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

type DirectoryRpcRow = {
  id: string;
  display_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  campus: string | null;
  photo_url: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  person_tags: PersonTag[] | null;
  total_count: number | string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPeople(filters: PeopleFilters): Promise<{
  people: PersonWithRelations[];
  total: number;
}> {
  const supabase = createServiceClient();
  const perf = createRequestPerformanceTracker('people-query');
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  // Validate tag filter format if present
  let validTagId: string | null = null;
  if (filters.tag) {
    if (UUID_REGEX.test(filters.tag)) {
      validTagId = filters.tag;
    } else {
      // Non-UUID tag filter cannot match
      return { people: [], total: 0 };
    }
  }

  // 1. Primary path: Unified PostgreSQL RPC
  const { data: rpcData, error: rpcError } = await perf.track(
    'people.directory_rpc',
    supabase.rpc('get_people_directory', {
      p_church_id: filters.church_id,
      p_search: filters.search?.trim() || null,
      p_status: filters.status && filters.status !== 'all' ? filters.status : null,
      p_tag_id: validTagId,
      p_page: page,
      p_page_size: pageSize,
    })
  );

  if (!rpcError && Array.isArray(rpcData)) {
    const rows = rpcData as DirectoryRpcRow[];
    const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

    const mappedPeople: PersonWithRelations[] = (rows.map((row) => ({
      id: row.id,
      display_id: row.display_id,
      church_id: filters.church_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      campus: row.campus,
      photo_url: row.photo_url,
      photo_path: row.photo_path,
      created_at: row.created_at,
      updated_at: row.updated_at,
      person_tags: Array.isArray(row.person_tags) ? row.person_tags : [],
    })) as unknown) as PersonWithRelations[];

    const people = await perf.track(
      'people.batch_photos',
      addSignedPhotoUrls(mappedPeople, filters.church_id)
    );

    perf.log();
    return { people, total };
  }

  // 2. Fallback path: Optimized PostgREST query if RPC is not available
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let taggedPersonIds: string[] | null = null;
  if (validTagId) {
    const { data: tagRows, error: tagError } = await perf.track(
      'people.tag_filter',
      supabase
        .from('person_tags')
        .select('person_id')
        .eq('church_id', filters.church_id)
        .eq('tag_id', validTagId)
    );
    if (tagError) throw tagError;
    taggedPersonIds = [...new Set((tagRows ?? []).map((row) => row.person_id))];
    if (taggedPersonIds.length === 0) {
      return { people: [], total: 0 };
    }
  }

  let query = supabase
    .from('people')
    .select(
      `
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
      person_tags!person_tags_church_person_fk(
        person_id,
        tag_id,
        created_at,
        tag:tags!person_tags_church_tag_fk(
          id,
          display_id,
          name,
          color,
          target_workflow_id,
          created_at
        )
      )
    `,
      { count: 'exact' }
    )
    .eq('church_id', filters.church_id)
    .order('last_name', { ascending: true })
    .range(from, to);

  if (filters.search) {
    const term = filters.search.trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (taggedPersonIds) {
    query = query.in('id', taggedPersonIds);
  }

  const { data, error, count } = await perf.track('people.list_fallback', query);
  if (error) throw error;

  const peopleRows = (data as unknown as PersonWithRelations[]) ?? [];
  const people = await perf.track(
    'people.batch_photos',
    addSignedPhotoUrls(peopleRows, filters.church_id)
  );

  perf.log();
  return { people, total: count ?? 0 };
}
