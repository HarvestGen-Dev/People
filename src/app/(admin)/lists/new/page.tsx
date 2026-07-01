import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { SmartListBuilder } from '@/components/lists/SmartListBuilder';
import { StaticListBuilder } from '@/components/lists/StaticListBuilder';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'New List | People',
};

export default async function NewListPage({ searchParams }: { searchParams: Promise<{ type: string, name: string }> }) {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

  const { type, name } = await searchParams;

  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, color')
    .eq('church_id', churchId)
    .order('name');

  return (
    <>
      <Topbar title="New List" />
      <div className="mx-auto max-w-6xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        {type === 'static' ? (
          <StaticListBuilder initialName={name || ''} />
        ) : (
          <SmartListBuilder initialName={name || ''} tags={tags || []} />
        )}
      </div>
    </>
  );
}
