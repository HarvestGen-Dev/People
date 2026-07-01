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

  const { data: tags, error } = await supabase
    .from('tags')
    .select('*, person_tags(count)')
    .eq('church_id', churchId)
    .order('name');

  const tagsWithCount = (tags || []).map(t => ({
    ...t,
    people_count: t.person_tags?.[0]?.count || 0
  }));

  return (
    <>
      <Topbar title="Tags" />
      <div className="p-8 max-w-4xl animate-in fade-in-50 duration-300">
        <TagsManager initialTags={tagsWithCount} churchId={churchId} />
      </div>
    </>
  );
}
