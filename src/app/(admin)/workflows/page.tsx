import { createServiceClient } from '@/lib/supabase/server';
import { WorkflowIndexManager } from '@/components/workflows/WorkflowIndexManager';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Workflows | People',
};

export default async function WorkflowsPage() {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();

  const { data: workflowsData } = await supabase
    .from('workflows')
    .select(`
      *,
      workflow_steps!workflow_steps_church_workflow_fk(id),
      workflow_cards!workflow_cards_church_workflow_fk(id, completed_at)
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
    <div className="mx-auto max-w-[1440px] p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
      <WorkflowIndexManager initialWorkflows={workflows} />
    </div>
  );
}
