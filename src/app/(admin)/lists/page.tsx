import { createServiceClient } from '@/lib/supabase/server';
import { ListIndexManager } from '@/components/lists/ListIndexManager';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Lists | People',
};

export default async function ListsPage() {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();

  // Fetch all lists with static member counts
  const { data: lists } = await supabase
    .from('lists')
    .select(`
      *,
      member_count:list_people!list_people_church_list_fk(count)
    `)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  // Map counts properly (for static lists only, smart lists will be handled on client or dynamically)
  const formattedLists = (lists || []).map(l => ({
    ...l,
    member_count: l.type === 'static' ? l.member_count?.[0]?.count || 0 : null
  }));

  return (
    <div className="mx-auto max-w-[1440px] p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
      <ListIndexManager initialLists={formattedLists} />
    </div>
  );
}
