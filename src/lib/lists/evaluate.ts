import { createServiceClient } from '@/lib/supabase/server';
import {
  PersonSummary,
  SmartListFilters,
  SmartListRule,
} from '@/lib/types';
import { addSignedPhotoUrls } from '@/lib/people/photos';

export async function evaluateSmartList(
  filters: SmartListFilters,
  churchId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ people: PersonSummary[]; total: number }> {
  const supabase = createServiceClient();

  // Basic validation
  if (!filters || !filters.rules || filters.rules.length === 0) {
    return { people: [], total: 0 };
  }

  // To build an OR query in Supabase via PostgREST, we have to construct an or string.
  // We can also just use the query builder properly.
  // Actually, for complex queries with joins (like tag includes), PostgREST `or` is very tricky.
  // A robust way is to build the query.
  
  let query = supabase
    .from('people')
    .select('id, display_id, first_name, last_name, email, phone, status, campus, photo_url, photo_path, created_at, updated_at', { count: 'exact' })
    .eq('church_id', churchId);

  // If AND, we can just chain filters.
  // If OR, it's more complicated. Let's build a postgrest OR string for simple fields.
  if (filters.operator === 'AND') {
    for (const rule of filters.rules) {
      if (rule.field === 'status') {
        if (rule.op === 'is') query = query.eq('status', rule.value);
        if (rule.op === 'is_not') query = query.neq('status', rule.value);
      }
      if (rule.field === 'campus') {
        if (rule.op === 'is') query = query.eq('campus', rule.value);
        if (rule.op === 'is_not') query = query.neq('campus', rule.value);
        if (rule.op === 'contains') query = query.ilike('campus', `%${rule.value}%`);
      }
      if (rule.field === 'gender') {
        if (rule.op === 'is') query = query.eq('gender', rule.value);
      }
      if (rule.field === 'created_at') {
        if (rule.op === 'within_last_days') {
          const d = new Date(Date.now() - parseInt(rule.value ?? '0') * 86400000).toISOString();
          query = query.gte('created_at', d);
        }
        if (rule.op === 'is_before') query = query.lt('created_at', rule.value);
        if (rule.op === 'is_after') query = query.gt('created_at', rule.value);
      }
      if (rule.field === 'has_no_email') {
        query = query.is('email', null);
      }
      // For tags:
      // tag includes -> we can use inner join if it's the only one, or use a subquery string if supported.
      // Supabase JS doesn't support WHERE id IN (SELECT ...) easily without RPC.
      // But we can fetch matching IDs first, OR we can use foreign tables.
      // Since `AND` means all must be true, if there are tag filters, we might have to filter by ID.
    }
  }

  // Given Supabase PostgREST limits with complex ORs and subqueries for relations, 
  // the most robust way to evaluate a complex smart list is to fetch all people for the church
  // and evaluate in memory, OR use an RPC. Since we want a pure JS solution as per standard Next.js,
  // and church size might be a few thousand, we can do hybrid or just fetch people with their tags.
  // For production with 100k people, you'd use a plpgsql function.
  // Let's implement a robust JS evaluation for now, fetching all relevant data.
  // For preview/eval, we'll fetch all people for the church with tags, then filter.

  // Fetch all people with tags for this church
  const { data: allPeople, error } = await supabase
    .from('people')
    .select(`
      id, display_id, first_name, last_name, email, phone, status, campus, gender, created_at, updated_at, photo_url, photo_path,
      person_tags!person_tags_church_person_fk(tag_id)
    `)
    .eq('church_id', churchId);

  if (error || !allPeople) {
    throw new Error('Failed to evaluate list: ' + (error?.message || ''));
  }

  const matched = allPeople.filter(person => {
    const personTags = person.person_tags?.map(
      (personTag: { tag_id: string }) => personTag.tag_id
    ) || [];

    const evaluateRule = (rule: SmartListRule) => {
      if (rule.field === 'status') {
        if (rule.op === 'is') return person.status === rule.value;
        if (rule.op === 'is_not') return person.status !== rule.value;
      }
      if (rule.field === 'campus') {
        const c = (person.campus || '').toLowerCase();
        const v = (rule.value || '').toLowerCase();
        if (rule.op === 'is') return c === v;
        if (rule.op === 'is_not') return c !== v;
        if (rule.op === 'contains') return c.includes(v);
      }
      if (rule.field === 'gender') {
        if (rule.op === 'is') return person.gender === rule.value;
      }
      if (rule.field === 'created_at') {
        const pDate = new Date(person.created_at).getTime();
        if (rule.op === 'within_last_days') {
          const cutoff = Date.now() - parseInt(rule.value ?? '0') * 86400000;
          return pDate >= cutoff;
        }
        if (rule.op === 'is_before') return pDate < new Date(rule.value ?? '').getTime();
        if (rule.op === 'is_after') return pDate > new Date(rule.value ?? '').getTime();
      }
      if (rule.field === 'has_no_email') {
        return !person.email;
      }
      if (rule.field === 'tag') {
        if (rule.op === 'includes') return personTags.includes(rule.value ?? '');
        if (rule.op === 'excludes') return !personTags.includes(rule.value ?? '');
      }
      return false;
    };

    if (filters.operator === 'AND') {
      return filters.rules.every(evaluateRule);
    } else {
      return filters.rules.some(evaluateRule);
    }
  });

  const total = matched.length;
  
  // Apply limit/offset
  let paginated = matched;
  if (options.offset !== undefined) {
    paginated = paginated.slice(options.offset);
  }
  if (options.limit !== undefined) {
    paginated = paginated.slice(0, options.limit);
  }

  // Format to PersonSummary
  const resultPeople = paginated.map(p => ({
    id: p.id,
    display_id: p.display_id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    status: p.status,
    campus: p.campus,
    photo_url: p.photo_url,
    photo_path: p.photo_path,
    tags: [], // Could join full tags if needed, but summary is usually enough
    created_at: p.created_at,
    updated_at: p.updated_at,
  })) as PersonSummary[];

  const signedPeople = await addSignedPhotoUrls(resultPeople, churchId);

  return {
    people: signedPeople,
    total
  };
}
