// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { WorkflowIndexManager } from '@/components/workflows/WorkflowIndexManager';
import { WorkflowGrid } from '@/components/workflows/index/WorkflowGrid';
import { FollowUpRows, type FollowUp } from '@/components/workflows/FollowUpRows';
import { EmptyState, PageHeader, PanelHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = { title: 'Follow-ups' };
const pageSize = 20;

export default async function WorkflowsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage = isPlatformAdmin || role === 'owner' || role === 'admin';
  const canComplete = canManage || role === 'workflow_manager';
  const { view: requestedView, page: requestedPage } = await searchParams;
  const view = requestedView === 'completed' || requestedView === 'boards' ? requestedView : 'open';
  const pageNumber = Number(requestedPage);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 1_000_000 ? pageNumber : 1;
  const supabase = createServiceClient();

  async function renderBoards() {
    const { data: workflowsData, error } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_steps!workflow_steps_church_workflow_fk(id),
        workflow_cards!workflow_cards_church_workflow_fk(id, completed_at)
      `)
      .eq('church_id', churchId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const workflows = (workflowsData || []).map(w => ({
      ...w,
      steps_count: w.workflow_steps.length,
      active_cards: w.workflow_cards.filter((card: { completed_at: string | null }) => !card.completed_at).length,
      completed_cards: w.workflow_cards.filter((card: { completed_at: string | null }) => !!card.completed_at).length,
    }));
    return workflows.length ? <WorkflowGrid workflows={workflows} /> : (
      <section className="workspace-panel">
        <EmptyState title="No workflow boards" description={canManage ? 'Create a workflow to set up its steps and add people.' : 'Workflow boards will appear here when your team creates them.'} />
      </section>
    );
  }

  function queueHref(nextPage: number) {
    const params = new URLSearchParams();
    if (view === 'completed') params.set('view', view);
    if (nextPage > 1) params.set('page', String(nextPage));
    return params.size ? `/workflows?${params}` : '/workflows';
  }

  async function renderQueue() {
    const offset = (page - 1) * pageSize;
    let query = supabase.from('workflow_cards').select(`
      id, due_date, completed_at,
      people!workflow_cards_church_person_fk!inner(id, display_id, first_name, last_name),
      workflow_steps!workflow_cards_church_current_step_fk(name),
      workflows!workflow_cards_church_workflow_fk!inner(id, display_id, name)
    `).eq('church_id', churchId);
    query = view === 'completed'
      ? query.not('completed_at', 'is', null).order('completed_at', { ascending: false })
      : query.is('completed_at', null).order('due_date', { ascending: true, nullsFirst: false });
    const { data, error } = await query.order('id').range(offset, offset + pageSize);
    if (error) throw error;
    const rows = (data ?? []) as unknown as FollowUp[];
    return (
      <section className="workspace-panel" id="follow-up-queue" tabIndex={-1} aria-label="Follow-up queue">
        <PanelHeader title={view === 'completed' ? 'Completed follow-ups' : 'Open follow-ups'}
          description={view === 'completed' ? 'Most recently completed first.' : 'Ordered by due date. Open a person’s workflow to manage their next step.'} />
        {rows.length ? <FollowUpRows cards={rows.slice(0, pageSize)} canComplete={canComplete} focusTarget="follow-up-queue" />
          : <EmptyState title="No follow-ups on this page" description={view === 'completed' ? 'Completed follow-ups will appear here.' : 'Add someone to a workflow board to start a follow-up.'} />}
        {(page > 1 || rows.length > pageSize) && (
          <nav className="directory-pagination" aria-label="Follow-up pages">
            <span>Page {page}</span>
            <div className="workspace-actions">
              {page > 1 && <Link href={queueHref(page - 1)} prefetch={false} className="workspace-button">Previous</Link>}
              {rows.length > pageSize && <Link href={queueHref(page + 1)} prefetch={false} className="workspace-button">Next</Link>}
            </div>
          </nav>
        )}
      </section>
    );
  }

  return (
    <WorkspacePage>
      <PageHeader eyebrow="Care and next steps" title="Follow-ups"
        description="See who needs a next step, or open a workflow board to manage its stages."
        actions={canManage && <WorkflowIndexManager />} />
      <nav aria-label="Follow-up views" className="workspace-tabs">
        <Link href="/workflows" aria-current={view === 'open' ? 'page' : undefined}>Open</Link>
        <Link href="/workflows?view=completed" aria-current={view === 'completed' ? 'page' : undefined}>Completed</Link>
        <Link href="/workflows?view=boards" aria-current={view === 'boards' ? 'page' : undefined}>Workflow boards</Link>
      </nav>
      {view === 'boards' ? await renderBoards() : await renderQueue()}
    </WorkspacePage>
  );
}
