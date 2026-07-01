import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { WorkflowIndexManager } from '@/components/workflows/WorkflowIndexManager';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Workflows | People',
};

export default async function WorkflowsPage() {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();

  // We can just fetch all workflows and their cards here, or compute counts.
  // The query `COUNT(wc.id) FILTER (WHERE wc.completed_at IS NULL)` requires RPC or raw SQL 
  // if not supported by PostgREST easily. We can fetch workflows and cards and reduce in JS.
  const { data: workflowsData } = await supabase
    .from('workflows')
    .select(`
      *,
      workflow_steps(id),
      workflow_cards(id, completed_at)
    `)
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  const workflows = (workflowsData || []).map(w => {
    const active_cards = w.workflow_cards.filter(
      (card: { completed_at: string | null }) => !card.completed_at
    ).length;
    const completed_cards = w.workflow_cards.filter(
      (card: { completed_at: string | null }) => !!card.completed_at
    ).length;
    return {
      ...w,
      steps_count: w.workflow_steps.length,
      active_cards,
      completed_cards,
    };
  });

  return (
    <>
      <Topbar title="Workflows" />
      <div className="p-8 max-w-6xl animate-in fade-in-50 duration-300">
        <WorkflowIndexManager initialWorkflows={workflows} />
      </div>
    </>
  );
}
