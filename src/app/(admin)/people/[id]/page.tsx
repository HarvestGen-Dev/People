import { getPersonById, getPersonNotes, getPersonEvents, getPersonWorkflowCards } from '@/lib/queries/person';
import { notFound } from 'next/navigation';
import { PersonProfile } from '@/components/people/PersonProfile';
import { ArrowLeft, Pencil } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/Workspace';
import { formatAddedDate, PersonAvatar, PersonStatus } from '@/components/people/PersonIdentity';
import Link from 'next/link';
import { requireTenantContext } from '@/lib/tenant-context';
import { redirect } from 'next/navigation';
import { displayIdFor } from '@/lib/display-ids';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { churchId } = await requireTenantContext();
  const person = await getPersonById(id, churchId);
  return { title: person ? `${person.first_name} ${person.last_name} | People` : 'Person Not Found' };
}

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();

  if (role === 'workflow_manager') {
    redirect('/workflows');
  }

  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';

  const person = await getPersonById(id, churchId);
  if (!person) notFound();

  const [notes, events, workflowCards] = await Promise.all([
    getPersonNotes(person.id, churchId),
    getPersonEvents(person.id, churchId),
    getPersonWorkflowCards(person.id, churchId)
  ]);

  return (
    <WorkspacePage>
      <Link href="/people" className="workspace-link mb-3"><ArrowLeft size={16} aria-hidden="true" /> Back to directory</Link>
      <header className="workspace-panel flex flex-wrap items-start gap-4 p-5 sm:p-6">
        <PersonAvatar person={person} large />
        <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{person.first_name} {person.last_name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PersonStatus status={person.status} />
            {person.person_tags?.map(({ tag }) => tag && <span key={tag.id} className="directory-tag">{tag.name}</span>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {person.email && <a href={`mailto:${person.email}`} className="text-primary underline-offset-2 hover:underline">{person.email}</a>}
            {person.phone && <a href={`tel:${person.phone}`} className="text-primary underline-offset-2 hover:underline">{person.phone}</a>}
            {person.campus && <span>{person.campus}</span>}
            {person.birthdate && <span>Born {formatAddedDate(person.birthdate)}</span>}
          </div>
          {person.created_at && <p className="mt-2 text-xs text-muted-foreground">Added {formatAddedDate(person.created_at)}</p>}
        </div>
        {canManage && <Link href={`/people/${displayIdFor(person)}/edit`} className="workspace-button"><Pencil size={16} aria-hidden="true" /> Edit person</Link>}
      </header>
      <PersonProfile person={person} notes={notes} events={events} workflowCards={workflowCards} />
    </WorkspacePage>
  );
}
