import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { SmartListBuilder } from '@/components/lists/SmartListBuilder';
// Wait, prompt says: "For Static lists → go to `/lists/new?type=static` ... Full builder on the dedicated page".
// But static list builder wasn't explicitly described for "new", only the detail page.
// We can just redirect to creating it and then viewing it, or we can handle both in "new".
// Actually, creating a static list is just a name and then going to the page. 
// I'll create the static list right here if it's static, or I'll just provide a simple save for static list.

import { StaticListBuilder } from '@/components/lists/StaticListBuilder';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'New List | People',
};

export default async function NewListPage({ searchParams }: { searchParams: Promise<{ type: string, name: string }> }) {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

  const { type, name } = await searchParams;

  // We need to fetch tags for the SmartListBuilder
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, color')
    .eq('church_id', churchId)
    .order('name');

  return (
    <>
      <Topbar title="New List" />
      <div className="p-8 max-w-5xl animate-in fade-in-50 duration-300">
        {type === 'static' ? (
          <StaticListBuilder initialName={name || ''} />
        ) : (
          <SmartListBuilder initialName={name || ''} tags={tags || []} />
        )}
      </div>
    </>
  );
}
