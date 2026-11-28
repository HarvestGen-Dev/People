// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { formDefinitionSchema, type FormDefinition } from '@/lib/hg-link/formSchema';
import { configuredChurchSlug, loadConfiguredChurch } from '@/lib/single-church';

export type ResolvedConnectForm = {
  churchId: string;
  slug: string;
  title: string;
  description: string | null;
  /** Published definition; null for legacy forms that use the original fixed fields. */
  definition: FormDefinition | null;
  definitionVersion: number;
  notifyEmail: string | null;
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
  const configuredSlug = configuredChurchSlug();
  if (configuredSlug && churchSlug !== configuredSlug) return null;
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
  const configuredChurch = await loadConfiguredChurch();
  if (configuredChurch) return loadForm(configuredChurch.id, formSlug);
  const supabase = createServiceClient();
  const { data: churchId } = await supabase.rpc('resolve_unique_connect_form_church', {
    p_slug: formSlug,
  });
  if (typeof churchId !== 'string') return null;
  return loadForm(churchId, formSlug);
}

export async function resolveConnectFormById(churchId: string, formSlug: string) {
  return loadForm(churchId, formSlug);
}

async function loadForm(churchId: string, formSlug: string): Promise<ResolvedConnectForm | null> {
  const configuredChurch = await loadConfiguredChurch();
  if (configuredChurch && churchId !== configuredChurch.id) return null;
  const supabase = createServiceClient();
  const { data: form } = await supabase
    .from('connect_forms')
    .select('slug, title, description, definition, definition_version, notify_email')
    .eq('church_id', churchId)
    .eq('slug', formSlug)
    .eq('is_active', true)
    .maybeSingle();
  if (!form) return null;
  // Re-validate stored JSON so a bad row can never reach a public renderer.
  const parsed = form.definition ? formDefinitionSchema.safeParse(form.definition) : null;
  return {
    churchId,
    slug: form.slug,
    title: form.title,
    description: form.description,
    definition: parsed?.success ? parsed.data : null,
    definitionVersion: form.definition_version ?? 0,
    notifyEmail: form.notify_email ?? null,
  };
}
