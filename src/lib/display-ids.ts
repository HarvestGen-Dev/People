// <!-- AGENT: BACKEND -->

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FilterableQuery<T> = {
  eq: (column: string, value: string) => T;
};

type SingleIdQuery = {
  eq: (column: string, value: string) => SingleIdQuery;
  single: () => PromiseLike<{ data: { id: string } | null }>;
};

type DisplayIdClient = {
  from: (table: string) => {
    select: (columns: string) => SingleIdQuery;
  };
};

export function isDatabaseId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function displayIdFor(record: {
  display_id?: string | null;
  id: string;
}): string {
  return record.display_id || record.id;
}

export function applyDisplayOrDatabaseIdFilter<T extends FilterableQuery<T>>(
  query: T,
  identifier: string
): T {
  return query.eq(isDatabaseId(identifier) ? 'id' : 'display_id', identifier);
}

export function publicPersonId(person: {
  display_id?: string | null;
  id: string;
}): string {
  return displayIdFor(person);
}

export async function resolveScopedRecordIds(
  client: unknown,
  table: string,
  identifiers: string[],
  churchId: string
): Promise<string[]> {
  const resolvedIds: string[] = [];
  const displayIdClient = client as DisplayIdClient;

  for (const identifier of identifiers) {
    const query = displayIdClient
      .from(table)
      .select('id')
      .eq('church_id', churchId);

    const { data } = await applyDisplayOrDatabaseIdFilter(query, identifier)
      .single();

    if (!data) {
      throw new Error(`${table} record not found`);
    }

    resolvedIds.push(data.id);
  }

  return resolvedIds;
}
