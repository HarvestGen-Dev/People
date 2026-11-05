import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CreateListButton, DeleteListButton } from '@/components/lists/ListIndexManager';
import { EmptyState, PageHeader, PanelHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { formatAddedDate } from '@/components/people/PersonIdentity';
import { displayIdFor } from '@/lib/display-ids';
import type { ListWithCount, SmartListFilters } from '@/lib/types';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Lists | People',
};

export default async function ListsPage() {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage = isPlatformAdmin || role === 'owner' || role === 'admin';
  const supabase = createServiceClient();

  // Fetch all lists with static member counts
  const { data: lists, error } = await supabase
    .from('lists')
    .select(`
      *,
      member_count:list_people!list_people_church_list_fk(count)
    `)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const formattedLists = (lists || []).map(list => ({
    ...list,
    member_count: list.type === 'static' ? list.member_count?.[0]?.count || 0 : null,
  })) as (ListWithCount & { filters: SmartListFilters | null })[];

  return (
    <WorkspacePage>
      <PageHeader eyebrow="Saved audiences" title="Lists"
        description="Find the right group without rebuilding your filters."
        actions={canManage && <CreateListButton />} />
      <div className="space-y-5">
        {(['smart', 'static'] as const).map((type) => {
          const smart = type === 'smart';
          const group = formattedLists.filter((list) => list.type === type);
          return (
            <section key={type} className="workspace-panel" aria-label={smart ? 'Smart lists' : 'Static lists'}>
              <PanelHeader title={smart ? 'Smart lists' : 'Static lists'}
                description={`${group.length} ${group.length === 1 ? 'list' : 'lists'} · ${smart ? 'People who match a set of rules.' : 'People selected and managed by your team.'}`} />
              {group.length ? <ul className="workspace-rows">
                {group.map((list) => {
                  const id = displayIdFor(list);
                  const ruleCount = list.filters?.rules?.length ?? 0;
                  const count = list.member_count ?? 0;
                  return (
                    <li key={id} className="workspace-row">
                      <div className="workspace-row-content">
                        <Link href={`/lists/${id}`} className="workspace-row-link inline-flex min-h-8 items-center">{list.name}</Link>
                        <p>{smart ? `${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'} · Match ${list.filters?.operator ?? 'ALL'}`
                          : `${count} ${count === 1 ? 'person' : 'people'} selected`} · Created {formatAddedDate(list.created_at)}</p>
                      </div>
                      {canManage && <DeleteListButton listId={list.id} name={list.name} />}
                    </li>
                  );
                })}
              </ul> : <EmptyState title={`No ${type} lists yet`} description={canManage ? 'Use New list to create one.' : 'Lists will appear here when your team creates them.'} />}
            </section>
          );
        })}
      </div>
    </WorkspacePage>
  );
}
