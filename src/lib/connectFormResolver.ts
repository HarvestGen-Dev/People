// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';

export type ResolvedConnectForm = {
  churchId: string;
  slug: string;
  title: string;
  description: string | null;
};

/**
 * Resolve an active connect form unambiguously within one tenant.
 * Form slugs are only unique per church (UNIQUE (church_id, slug)), so a slug
 * on its own must never be used to pick a form.
 */
export async function resolveConnectForm(
  churchSlug: string,
  formSlug: string
): Promise<ResolvedConnectForm | null> {
  const supabase = createServiceClient();
  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .maybeSingle();
  if (!church) return null;
  return loadForm(church.id, formSlug);
}

/**
 * Legacy `/connect/<slug>` URLs predate tenant-scoped paths. They keep working
 * only while the slug is unique across all churches; ambiguous slugs return null.
 */
export async function resolveLegacyConnectForm(
  formSlug: string
): Promise<ResolvedConnectForm | null> {
  const supabase = createServiceClient();
  const { data: churchId } = await supabase.rpc('resolve_unique_connect_form_church', {
    p_slug: formSlug,
  });
  if (typeof churchId !== 'string') return null;
  return loadForm(churchId, formSlug);
}

async function loadForm(churchId: string, formSlug: string): Promise<ResolvedConnectForm | null> {
  const supabase = createServiceClient();
  const { data: form } = await supabase
    .from('connect_forms')
    .select('slug, title, description')
    .eq('church_id', churchId)
    .eq('slug', formSlug)
    .eq('is_active', true)
    .maybeSingle();
  if (!form) return null;
  return { churchId, slug: form.slug, title: form.title, description: form.description };
}
