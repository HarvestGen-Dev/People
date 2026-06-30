import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { TagsManager } from '@/components/settings/TagsManager';

export const metadata = {
  title: 'Tags | Settings',
};

export default async function TagsSettingsPage() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  const churchSlug = user?.user_metadata?.church_slug || 'harvestgen';

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single();

  const churchId = church?.id;

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
