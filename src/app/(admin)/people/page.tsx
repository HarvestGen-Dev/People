import { createClient } from '@/lib/supabase/server';
import { PersonTable } from '@/components/people/PersonTable';
import { PeopleFilters } from '@/components/people/PeopleFilters';
import { Plus } from 'lucide-react';
import { PageHeader, PanelHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { ProfilePreview } from '@/components/people/ProfilePreview';
import { displayIdFor } from '@/lib/display-ids';
import Link from 'next/link';
import { getPeople, PeopleFilters as QueryFilters } from '@/lib/queries/people';
import { Tag } from '@/lib/types';
import { requireTenantContext } from '@/lib/tenant-context';
import { redirect } from 'next/navigation';
import { createRequestPerformanceTracker } from '@/lib/performance';

export const metadata = {
  title: 'People | HarvestGen',
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  
  if (role === 'workflow_manager') {
    redirect('/workflows');
  }

  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const supabase = await createClient();
  const perf = createRequestPerformanceTracker('people-page');

  const resolvedSearchParams = await searchParams;
  const requestedPage = Number(resolvedSearchParams.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1_000_000 ? requestedPage : 1;
  const pageSize = 50;
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : undefined;
  const tag = typeof resolvedSearchParams.tag === 'string' && resolvedSearchParams.tag !== 'all' ? resolvedSearchParams.tag : undefined;

  const filters: QueryFilters = {
    church_id: churchId,
    page,
    pageSize,
    search,
    status,
    tag,
  };

  const [peopleRes, tagsRes] = await Promise.all([
    getPeople(filters),
    perf.track('people.tags', supabase
      .from('tags')
      .select('id, display_id, name, color, target_workflow_id, created_at')
      .eq('church_id', churchId)
      .order('name'))
  ]);

  const { people, total } = peopleRes;
  const { data: tagsData } = tagsRes;
    
  const tags = (tagsData as Tag[]) || [];
  perf.log();

  function directoryHref(nextPage: number, preview?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    if (tag && tag !== 'all') params.set('tag', tag);
    if (nextPage > 1) params.set('page', String(nextPage));
    if (preview) params.set('preview', preview);
    return params.size ? `/people?${params}` : '/people';
  }

  if (page > 1 && !people.length) redirect(directoryHref(1));
  const preview = people.find((person) => displayIdFor(person) === resolvedSearchParams.preview);
  const first = (page - 1) * pageSize + 1;
  const last = first + people.length - 1;

  return (
    <WorkspacePage>
      <PageHeader eyebrow="Directory" title="People"
        description="Find members and visitors, and take the next step in caring for them."
        actions={canManage && <>
          <Link href="/people/duplicates" className="workspace-link">Review duplicates</Link>
          <Link href="/people/new" className="workspace-button" data-primary><Plus size={16} aria-hidden="true" /> Add person</Link>
        </>}
      />
      <PeopleFilters tags={tags} search={search} status={status} tag={tag} />
      <section className="workspace-panel" aria-label="Directory results">
        <PanelHeader title="Directory" description={`${total.toLocaleString('en-MY')} ${total === 1 ? 'person' : 'people'}`} />
        <PersonTable people={people} hrefForPreview={(id) => directoryHref(page, id)} />
        {!!people.length && (
          <nav className="directory-pagination" aria-label="People pagination">
            <p role="status">Showing {first.toLocaleString('en-MY')}–{last.toLocaleString('en-MY')} of {total.toLocaleString('en-MY')}</p>
            {total > pageSize && <div className="workspace-actions">
              {page > 1 ? <Link href={directoryHref(page - 1)} prefetch={false} className="workspace-button">Previous</Link>
                : <span className="workspace-button" aria-disabled="true">Previous</span>}
              {last < total ? <Link href={directoryHref(page + 1)} prefetch={false} className="workspace-button">Next</Link>
                : <span className="workspace-button" aria-disabled="true">Next</span>}
            </div>}
          </nav>
        )}
      </section>
      {preview && <ProfilePreview key={preview.id} person={preview} canManage={canManage} closeHref={directoryHref(page)} />}
    </WorkspacePage>
  );
}
