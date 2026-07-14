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

function normalizedName(person: DuplicatePersonCandidate) {
  return `${person.first_name} ${person.last_name}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

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

function groupCandidates(
  people: DuplicatePersonCandidate[],
  keyFor: (person: DuplicatePersonCandidate) => string | null,
  reason: DuplicatePeopleGroup['reason'],
  confidence: DuplicatePeopleGroup['confidence'],
  labelFor: (key: string) => string
) {
  const buckets = new Map<string, DuplicatePersonCandidate[]>();

  people.forEach((person) => {
    const key = keyFor(person);
    if (!key) return;

    buckets.set(key, [...(buckets.get(key) || []), person]);
  });

  return [...buckets.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      reason,
      label: labelFor(key),
      confidence,
      people: sortGroupPeople(group),
    }));
}

export async function getDuplicatePeopleGroups(
  churchId: string
): Promise<DuplicatePeopleGroup[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('people')
    .select(
      'id, display_id, first_name, last_name, email, phone, phone_normalized, status, campus, created_at, updated_at'
    )
    .eq('church_id', churchId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const people = (data || []) as DuplicatePersonCandidate[];
  const groups = [
    ...groupCandidates(
      people,
      (person) => person.phone_normalized,
      'shared_phone',
      'high',
      (key) => key
    ),
    ...groupCandidates(
      people,
      (person) => {
        const name = normalizedName(person);
        return name.length >= 4 ? name : null;
      },
      'same_name',
      'medium',
      (key) => key
    ),
  ];

  const seen = new Set<string>();

  return groups
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
