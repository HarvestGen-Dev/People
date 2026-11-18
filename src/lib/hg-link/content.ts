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

function parseContent(value: unknown): HgLinkContent | null {
  const parsed = contentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Public read: the published revision for exactly one church, or built-in defaults. */
export async function loadPublishedContent(churchId: string): Promise<HgLinkContent> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('hg_link_revisions')
    .select('content')
    .eq('church_id', churchId)
    .eq('status', 'published')
    .maybeSingle();
  return (data && parseContent(data.content)) || defaultHgLinkContent();
}

export async function resolveChurchBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('churches')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  return data as { id: string; name: string; slug: string } | null;
}

export function defaultChurchSlug(): string | null {
  return process.env.HG_LINK_CHURCH_SLUG?.trim() || null;
}

export async function loadAdminState(churchId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('hg_link_revisions')
    .select('id, status, version, content, created_at, published_at')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  const rows = (data ?? []) as RevisionRow[];
  const published = rows.find((r) => r.status === 'published');
  const draft = rows.find((r) => r.status === 'draft');
  const publishedContent = (published && parseContent(published.content)) || defaultHgLinkContent();
  return {
    publishedContent,
    draftContent: (draft && parseContent(draft.content)) || null,
    hasPublished: Boolean(published),
    history: rows.flatMap((r) =>
      r.status === 'draft'
        ? []
        : [{ id: r.id, version: r.version, status: r.status, publishedAt: r.published_at }]
    ),
  };
}
