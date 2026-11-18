// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import type { FormDefinition, ResolvedOptions } from './formSchema';

/**
 * Resolve options for fields with optionsSource = 'lists'.
 * Connect Groups are maintained as static People lists, so the form always
 * offers what staff currently manage instead of a hardcoded HG1-HG10 list.
 */
export async function resolveFormOptions(
  churchId: string,
  definition: FormDefinition
): Promise<ResolvedOptions> {
  const needsLists = definition.fields.some((f) => f.optionsSource === 'lists' && !f.hidden);
  if (!needsLists) return {};

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('lists')
    .select('id, name')
    .eq('church_id', churchId)
    .eq('type', 'static')
    .order('name', { ascending: true })
    .limit(100);
  if (error) throw error;

  const options = (data ?? []).map((list) => ({ value: list.id as string, label: list.name as string }));
  const resolved: ResolvedOptions = {};
  for (const field of definition.fields) {
    if (field.optionsSource === 'lists') resolved[field.id] = options;
  }
  return resolved;
}
