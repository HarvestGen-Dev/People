// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';

export type DuplicatePersonCandidate = {
  id: string;
  display_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  status: string;
  campus: string | null;
  created_at: string;
  updated_at: string;
};

export type DuplicatePeopleGroup = {
  key: string;
  reason: 'shared_phone' | 'same_name';
  label: string;
  confidence: 'high' | 'medium';
  people: DuplicatePersonCandidate[];
};

type DuplicateCandidateRow = DuplicatePersonCandidate & {
  group_key: string;
  reason: DuplicatePeopleGroup['reason'];
  confidence: DuplicatePeopleGroup['confidence'];
};

function sortGroupPeople(people: DuplicatePersonCandidate[]) {
  return [...people].sort((a, b) => {
    const newestFirst =
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime();

    if (newestFirst !== 0) return newestFirst;
    return `${a.last_name} ${a.first_name}`.localeCompare(
      `${b.last_name} ${b.first_name}`
    );
  });
}

export async function getDuplicatePeopleGroups(
  churchId: string
): Promise<DuplicatePeopleGroup[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_duplicate_people_candidates', {
    p_church_id: churchId,
  });

  if (error) throw error;

  const rows = (data || []) as DuplicateCandidateRow[];
  const groupsByKey = new Map<string, DuplicatePeopleGroup>();

  rows.forEach((row) => {
    const key = `${row.reason}:${row.group_key}`;
    const existingGroup = groupsByKey.get(key);
    const person = {
      id: row.id,
      display_id: row.display_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      phone_normalized: row.phone_normalized,
      status: row.status,
      campus: row.campus,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (existingGroup) {
      existingGroup.people.push(person);
      return;
    }

    groupsByKey.set(key, {
      key: row.group_key,
      reason: row.reason,
      label: row.group_key,
      confidence: row.confidence,
      people: [person],
    });
  });

  const seen = new Set<string>();

  return [...groupsByKey.values()]
    .map((group) => ({
      ...group,
      people: sortGroupPeople(group.people),
    }))
    .filter((group) => {
      const signature = group.people
        .map((person) => person.display_id)
        .sort()
        .join(':');

      const dedupeKey = `${group.reason}:${signature}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((a, b) => {
      const confidenceOrder =
        (a.confidence === 'high' ? 0 : 1) -
        (b.confidence === 'high' ? 0 : 1);

      if (confidenceOrder !== 0) return confidenceOrder;
      return b.people.length - a.people.length;
    });
}
