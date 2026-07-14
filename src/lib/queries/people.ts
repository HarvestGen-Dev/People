import { createServiceClient } from '@/lib/supabase/server';
import type { PersonWithRelations } from '@/lib/types';

export type PeopleFilters = {
  church_id: string;
  search?: string;
  status?: string;
  tag?: string;
  quality?: string;
  page?: number;
  pageSize?: number;
};

export type PeopleQualityMetrics = {
  missingContact: number;
  missingEmail: number;
  missingPhone: number;
  missingCampus: number;
  missingPhoto: number;
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

  const selectString = `
      *,
      household:households(*),
      person_tags(tag:tags(*))
    `;

  let query = supabase
    .from('people')
    .select(selectString, { count: 'exact' })
    .eq('church_id', filters.church_id)
    .order('last_name', { ascending: true })
    .range(from, to);

  if (filters.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

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

  switch (filters.quality) {
    case 'missing_contact':
      query = query.is('email', null).is('phone', null);
      break;
    case 'missing_email':
      query = query.is('email', null);
      break;
    case 'missing_phone':
      query = query.is('phone', null);
      break;
    case 'missing_campus':
      query = query.is('campus', null);
      break;
    case 'missing_photo':
      query = query.is('photo_url', null);
      break;
  }

  const { data, error, count } = await query;
  if (error) throw error;
  
  return { people: (data as unknown as PersonWithRelations[]) ?? [], total: count ?? 0 };
}

export async function getPeopleQualityMetrics(
  churchId: string
): Promise<PeopleQualityMetrics> {
  const supabase = createServiceClient();

  const [
    missingContact,
    missingEmail,
    missingPhone,
    missingCampus,
    missingPhoto,
  ] = await Promise.all([
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .is('email', null)
      .is('phone', null),
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .is('email', null),
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .is('phone', null),
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .is('campus', null),
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .is('photo_url', null),
  ]);

  const errors = [
    missingContact.error,
    missingEmail.error,
    missingPhone.error,
    missingCampus.error,
    missingPhoto.error,
  ].filter(Boolean);

  if (errors[0]) throw errors[0];

  return {
    missingContact: missingContact.count ?? 0,
    missingEmail: missingEmail.count ?? 0,
    missingPhone: missingPhone.count ?? 0,
    missingCampus: missingCampus.count ?? 0,
    missingPhoto: missingPhoto.count ?? 0,
  };
}
