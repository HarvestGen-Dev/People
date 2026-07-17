import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { KanbanBoard } from '@/components/workflows/KanbanBoard';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireTenantContext } from '@/lib/tenant-context';
import type {
  Workflow,
  WorkflowAdminUser,
  WorkflowBoardCard,
  WorkflowStep,
} from '@/lib/types';
import { applyDisplayOrDatabaseIdFilter } from '@/lib/display-ids';
import { addSignedPhotoUrls } from '@/lib/people/photos';

export const metadata = {
  title: 'Workflow Board | People',
};

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();
  const { id } = await params;

  const workflowQuery = supabase
    .from('workflows')
    .select('*')
    .eq('church_id', churchId);

  const { data: workflow } = await applyDisplayOrDatabaseIdFilter(workflowQuery, id)
    .single();

  if (!workflow) {
    notFound();
  }

  const { data: steps } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflow.id)
    .order('position', { ascending: true });

  const { data: cardsData } = await supabase
    .from('workflow_cards')
    .select(`
      *,
      people:people!workflow_cards_church_person_fk(id, display_id, first_name, last_name, status, created_at, photo_url, photo_path)
    `)
    .eq('workflow_id', workflow.id);

  // <!-- AGENT: BACKEND -->
  // Memberships are the authoritative tenant access source.
  const { data: users } = await supabase
    .from('church_memberships')
    .select('user_id, role')
    .eq('church_id', churchId)
    .in('role', ['owner', 'admin']);

  const workflowCards = (cardsData || []) as unknown as WorkflowBoardCard[];
  const peopleWithSignedPhotos = await addSignedPhotoUrls(
    workflowCards.map((card) => card.people),
    churchId
  );
  const signedByPersonId = new Map(
    peopleWithSignedPhotos.map((person) => [person.id, person])
  );
  const cardsWithSignedPhotos = workflowCards.map((card) => ({
    ...card,
    people: signedByPersonId.get(card.people.id) ?? card.people,
  }));

  return (
    <>
      <Topbar title={workflow.name}>
        <Link
          href="/workflows"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All workflows
        </Link>
      </Topbar>
      <div className="overflow-hidden">
        <KanbanBoard
          workflow={workflow as Workflow}
          initialSteps={(steps || []) as WorkflowStep[]}
          initialCards={cardsWithSignedPhotos}
          users={(users || []) as WorkflowAdminUser[]}
        />
      </div>
    </>
  );
}
