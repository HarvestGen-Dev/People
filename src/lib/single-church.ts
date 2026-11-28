// <!-- AGENT: BACKEND -->
import 'server-only';

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/server';

export function configuredChurchSlug(): string | null {
  return process.env.PEOPLE_CHURCH_SLUG?.trim() ||
    (process.env.VERCEL_ENV ? 'harvestgen' : null);
}

/** Null means legacy multi-church mode; a missing configured church fails closed. */
export const loadConfiguredChurch = cache(async (): Promise<{ id: string; name: string; slug: string } | null> => {
  const slug = configuredChurchSlug();
  if (!slug) return null;
  const { data, error } = await createServiceClient()
    .from('churches').select('id, name, slug').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The configured church is unavailable');
  return data;
});
