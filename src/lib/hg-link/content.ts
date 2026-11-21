// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { contentSchema, defaultHgLinkContent, type HgLinkContent } from './contentSchema';

export type RevisionRow = {
  id: string;
  status: 'draft' | 'published' | 'archived';
  version: number | null;
  content: unknown;
  created_at: string;
  published_at: string | null;
};

/** Public read: the published revision for exactly one church, or built-in defaults. */
export async function loadPublishedContent(churchId: string): Promise<HgLinkContent> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('hg_link_revisions')
    .select('content')
    .eq('church_id', churchId)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  return data ? contentSchema.parse(data.content) : defaultHgLinkContent();
}

export async function resolveChurchBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('churches')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; slug: string } | null;
}

export function defaultChurchSlug(): string | null {
  return process.env.HG_LINK_CHURCH_SLUG?.trim() || null;
}

export async function loadAdminState(churchId: string) {
  const supabase = createServiceClient();
  // Active content must not fall out of the history window when an old draft is published.
  const [active, archived] = await Promise.all([
    supabase.from('hg_link_revisions')
      .select('id, status, version, content, created_at, published_at')
      .eq('church_id', churchId)
      .in('status', ['draft', 'published']),
    supabase.from('hg_link_revisions')
      .select('id, status, version, published_at')
      .eq('church_id', churchId)
      .eq('status', 'archived')
      .order('version', { ascending: false })
      .limit(29),
  ]);
  if (active.error) throw active.error;
  if (archived.error) throw archived.error;
  const rows = (active.data ?? []) as RevisionRow[];
  const published = rows.find((r) => r.status === 'published');
  const draft = rows.find((r) => r.status === 'draft');
  const publishedContent = published ? contentSchema.parse(published.content) : defaultHgLinkContent();
  return {
    publishedContent,
    draftContent: draft ? contentSchema.parse(draft.content) : null,
    hasPublished: Boolean(published),
    history: [...rows, ...(archived.data ?? [])]
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
      .flatMap((r) =>
        r.status === 'draft'
          ? []
          : [{ id: r.id, version: r.version, status: r.status, publishedAt: r.published_at }]
      ),
  };
}
