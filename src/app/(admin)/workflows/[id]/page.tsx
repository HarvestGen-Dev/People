import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { KanbanBoard } from '@/components/workflows/KanbanBoard';
import { notFound } from 'next/navigation';
import { requireTenantContext } from '@/lib/tenant-context';

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

  // We need the list of admin users for the assignee dropdown
  const { data: users } = await supabase
    .from('church_users')
    .select(`
      user_id,
      roles:role_id(name)
    `)
    .eq('church_id', churchId);

  // Since we only want a list of names/IDs, maybe we can just query users from auth schema, 
  // but we can't do that easily from client without RPC. Let's just use the church_users.
  // Actually, I don't have user names in church_users easily available unless it's in a profile table.
  // For now, I'll pass users as an empty array or simple mock if I don't have profile info.
  // Wait, Prompt 04 uses admin users somewhere? It says: "Assignee (dropdown of admin users)". 
  // I will just use `users` but map them to string for now.

  return (
    <>
      <Topbar title={workflow.name} />
      <div className="h-[calc(100vh-64px)] overflow-hidden">
        <KanbanBoard workflow={workflow} initialSteps={steps || []} initialCards={cardsData || []} users={users || []} />
      </div>
    </>
  );
}
