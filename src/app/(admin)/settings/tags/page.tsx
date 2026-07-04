// <!-- AGENT: FRONTEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { TagsManager } from '@/components/settings/TagsManager';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Tags | Settings',
};

export default async function TagsSettingsPage() {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

  const { data: tags } = await supabase
    .from('tags')
    .select('*, person_tags(count)')
    .eq('church_id', churchId)
    .order('name');

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, name')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name');

  const tagsWithCount = (tags || []).map(t => ({
    ...t,
    people_count: t.person_tags?.[0]?.count || 0
  }));

  return (
    <>
      <Topbar title="Tags" />
      <div className="mx-auto max-w-5xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <TagsManager initialTags={tagsWithCount} workflows={workflows || []} />
      </div>
    </>
  );
}
// <!-- AGENT: FRONTEND -->
