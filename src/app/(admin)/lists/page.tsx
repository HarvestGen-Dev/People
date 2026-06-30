import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { ListIndexManager } from '@/components/lists/ListIndexManager';

export const metadata = {
  title: 'Lists | People',
};

export default async function ListsPage() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  const churchSlug = user?.user_metadata?.church_slug || 'harvestgen';

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single();

  const churchId = church?.id;

  // Fetch all lists with static member counts
  const { data: lists } = await supabase
    .from('lists')
    .select(`
      *,
      member_count:list_people(count)
    `)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  // Map counts properly (for static lists only, smart lists will be handled on client or dynamically)
  const formattedLists = (lists || []).map(l => ({
    ...l,
    member_count: l.type === 'static' ? l.member_count?.[0]?.count || 0 : null
  }));

  return (
    <>
      <Topbar title="Lists" />
      <div className="p-8 max-w-6xl animate-in fade-in-50 duration-300">
        <ListIndexManager initialLists={formattedLists} churchId={churchId} />
      </div>
    </>
  );
}
