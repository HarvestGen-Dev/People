import { createClient } from '@/lib/supabase/server';
import { PersonTable } from '@/components/people/PersonTable';
import { PeopleFilters } from '@/components/people/PeopleFilters';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPeople, PeopleFilters as QueryFilters } from '@/lib/queries/people';
import { Tag } from '@/lib/types';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'People | HarvestGen',
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const supabase = await createClient();

  const resolvedSearchParams = await searchParams;
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const tag = typeof resolvedSearchParams.tag === 'string' ? resolvedSearchParams.tag : undefined;

  const filters: QueryFilters = {
    church_id: churchId,
    page,
    pageSize: 50,
    search,
    status,
    tag,
  };

  const { people, total } = await getPeople(filters);

  // Fetch all available tags for this church for the filter dropdown
  const { data: tagsData } = await supabase
    .from('tags')
    .select('*')
    .eq('church_id', churchId)
    .order('name');
    
  const tags = (tagsData as Tag[]) || [];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Directory
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">People</h1>
          <p className="mt-2 text-base text-slate-500">
            Find members and visitors, understand their story, and coordinate care.
          </p>
        </div>
        {canManage && (
          <Link href="/people/new">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl px-5 h-10 shadow-sm transition-all hover:shadow-md">
              <Plus className="h-4 w-4" />
              Add person
            </Button>
          </Link>
        )}
      </div>

      <PeopleFilters tags={tags} total={total} />
      
      <PersonTable people={people} />
      
      {total > filters.pageSize! && (
        <Pagination total={total} pageSize={filters.pageSize!} />
      )}
    </div>
  );
}
