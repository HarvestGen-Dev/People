import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { evaluateSmartList } from '@/lib/lists/evaluate';
import { SmartListDetail } from '@/components/lists/SmartListDetail';
import { StaticListDetail } from '@/components/lists/StaticListDetail';
import { notFound } from 'next/navigation';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'List | People',
};

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();
  const { id } = await params;

  const { data: list } = await supabase
    .from('lists')
    .select('*')
    .eq('id', id)
    .eq('church_id', churchId)
    .single();

  if (!list) {
    notFound();
  }

  let people: any[] = [];
  
  if (list.type === 'smart') {
    const evalResult = await evaluateSmartList(list.filters, churchId);
    people = evalResult.people;
    
    // We need tags for the builder inside the detail page just in case we render it or want to map tag names
    const { data: tags } = await supabase.from('tags').select('id, name, color').eq('church_id', churchId);

    return (
      <>
        <Topbar title={list.name} />
        <div className="p-8 max-w-6xl animate-in fade-in-50 duration-300">
          <SmartListDetail list={list} people={people} tags={tags || []} />
        </div>
      </>
    );
  } else {
    // Static list
    // Fetch members from list_people
    const { data: listMembers } = await supabase
      .from('list_people')
      .select(`
        person_id,
        people (
          id, first_name, last_name, email, phone, status, campus, photo_url
        )
      `)
      .eq('list_id', id);

    people = (listMembers || []).map(lm => lm.people).filter(Boolean);

    return (
      <>
        <Topbar title={list.name} />
        <div className="p-8 max-w-6xl animate-in fade-in-50 duration-300">
          <StaticListDetail list={list} people={people} />
        </div>
      </>
    );
  }
}
