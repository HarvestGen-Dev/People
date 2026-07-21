import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { evaluateSmartList } from '@/lib/lists/evaluate';
import { SmartListDetail } from '@/components/lists/SmartListDetail';
import { StaticListDetail } from '@/components/lists/StaticListDetail';
import { notFound } from 'next/navigation';
import { requireTenantContext } from '@/lib/tenant-context';
import type { ListPerson, SmartListFilters } from '@/lib/types';
import { applyDisplayOrDatabaseIdFilter } from '@/lib/display-ids';
import { addSignedPhotoUrls } from '@/lib/people/photos';

export const metadata = {
  title: 'List | People',
};

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();
  const { id } = await params;

  const listQuery = supabase
    .from('lists')
    .select('*')
    .eq('church_id', churchId);

  const { data: list } = await applyDisplayOrDatabaseIdFilter(listQuery, id)
    .single();

  if (!list) {
    notFound();
  }

  let people: ListPerson[] = [];
  
  if (list.type === 'smart') {
    const evalResult = await evaluateSmartList(list.filters, churchId);
    people = evalResult.people;
    
    // We need tags for the builder inside the detail page just in case we render it or want to map tag names
    const { data: tags } = await supabase.from('tags').select('id, name, color').eq('church_id', churchId);

    return (
      <>
        <Topbar title={list.name} />
        <div className="mx-auto max-w-[1440px] p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
          <SmartListDetail
            list={{ ...list, filters: list.filters as SmartListFilters | null }}
            people={people}
            tags={tags || []}
          />
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
        people!list_people_church_person_fk (
          id, display_id, first_name, last_name, email, phone, status, campus, photo_url, photo_path
        )
      `)
      .eq('list_id', list.id);

    const rawPeople = (listMembers || []).flatMap((listMember) =>
      Array.isArray(listMember.people)
        ? listMember.people
        : listMember.people
          ? [listMember.people]
          : []
    ) as ListPerson[];
    people = await addSignedPhotoUrls(rawPeople, churchId);

    return (
      <>
        <Topbar title={list.name} />
        <div className="mx-auto max-w-[1440px] p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
          <StaticListDetail list={list} people={people} />
        </div>
      </>
    );
  }
}
