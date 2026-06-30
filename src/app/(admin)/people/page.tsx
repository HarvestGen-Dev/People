import { createClient, createServiceClient } from '@/lib/supabase/server';
import { PersonTable } from '@/components/people/PersonTable';
import { PeopleFilters } from '@/components/people/PeopleFilters';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { getPeople, PeopleFilters as QueryFilters } from '@/lib/queries/people';
import { redirect } from 'next/navigation';
import { Tag } from '@/lib/types';

export const metadata = {
  title: 'People | HarvestGen',
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();
  
  // Get current user and church_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  
  const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
  const { data: church } = await serviceClient
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single();
    
  if (!church) redirect('/login');

  const resolvedSearchParams = await searchParams;
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const tag = typeof resolvedSearchParams.tag === 'string' ? resolvedSearchParams.tag : undefined;

  const filters: QueryFilters = {
    church_id: church.id,
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
    .eq('church_id', church.id)
    .order('name');
    
  const tags = (tagsData as Tag[]) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">People</h1>
          <p className="text-base text-muted-foreground mt-1.5">
            Manage your church members, visitors, and their data.
          </p>
        </div>
        <Link href="/people/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl px-5 h-10 shadow-sm transition-all hover:shadow-md">
            <Plus className="h-4 w-4" />
            Add person
          </Button>
        </Link>
      </div>

      <PeopleFilters tags={tags} total={total} />
      
      <PersonTable people={people} />
      
      {total > filters.pageSize! && (
        <Pagination total={total} pageSize={filters.pageSize!} />
      )}
    </div>
  );
}
