import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { KanbanBoard } from '@/components/workflows/KanbanBoard';
import { notFound } from 'next/navigation';
import { requireTenantContext } from '@/lib/tenant-context';
import type {
  Workflow,
  WorkflowAdminUser,
  WorkflowBoardCard,
  WorkflowStep,
} from '@/lib/types';

export const metadata = {
  title: 'Workflow Board | People',
};

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();
  const { id } = await params;

  const { data: workflow } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .eq('church_id', churchId)
    .single();

  if (!workflow) {
    notFound();
  }

  const { data: steps } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', id)
    .order('position', { ascending: true });

  const { data: cardsData } = await supabase
    .from('workflow_cards')
    .select(`
      *,
      people:person_id(id, first_name, last_name, status, created_at, photo_url)
    `)
    .eq('workflow_id', id);

  // <!-- AGENT: BACKEND -->
  // Memberships are the authoritative tenant access source.
  const { data: users } = await supabase
    .from('church_memberships')
    .select('user_id, role')
    .eq('church_id', churchId)
    .in('role', ['owner', 'admin']);

  return (
    <>
      <Topbar title={workflow.name} />
      <div className="h-[calc(100vh-64px)] overflow-hidden">
        <KanbanBoard
          workflow={workflow as Workflow}
          initialSteps={(steps || []) as WorkflowStep[]}
          initialCards={(cardsData || []) as unknown as WorkflowBoardCard[]}
          users={(users || []) as WorkflowAdminUser[]}
        />
      </div>
    </>
  );
}
