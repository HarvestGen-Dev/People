// <!-- AGENT: FRONTEND -->
import { redirect } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantContextError, requireTenantContext } from '@/lib/tenant-context';
import { loadAdminState } from '@/lib/hg-link/content';
import { HgLinkEditor } from './HgLinkEditor';
import { HgLinkTabs } from './HgLinkTabs';

export const metadata = { title: 'HG Link | Settings' };
export const dynamic = 'force-dynamic';

export default async function HgLinkSettingsPage() {
  let context;
  try {
    // Owner/admin only. Non-editors are sent to the part they may use.
    context = await requireTenantContext({ requireManager: true });
  } catch (error) {
    if (error instanceof TenantContextError && error.status === 403) redirect('/settings/hg-link/submissions');
    throw error;
  }

  const supabase = createServiceClient();
  const [state, { data: forms }] = await Promise.all([
    loadAdminState(context.churchId),
    supabase.from('connect_forms').select('slug, title').eq('church_id', context.churchId).eq('is_active', true).order('title'),
  ]);

  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const stateKey = `${state.history[0]?.id ?? 'none'}:${state.draftContent ? 'draft' : 'live'}`;

  return (
    <>
      <Topbar title="HG Link" />
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <HgLinkTabs active="page" showEditorTabs />
        <HgLinkEditor
          key={stateKey}
          initialContent={state.draftContent ?? state.publishedContent}
          publishedContent={state.publishedContent}
          hasServerDraft={state.draftContent !== null}
          history={state.history}
          forms={(forms ?? []) as { slug: string; title: string }[]}
          publicUrl={`${base}/link/${context.churchSlug}`}
        />
      </div>
    </>
  );
}
