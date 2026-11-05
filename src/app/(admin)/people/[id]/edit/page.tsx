import { createServiceClient } from '@/lib/supabase/server';
import { PersonForm } from '@/components/people/PersonForm';
import { PageHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPersonById } from '@/lib/queries/person';
import { requireTenantContext } from '@/lib/tenant-context';
import { displayIdFor } from '@/lib/display-ids';

export const metadata = {
  title: 'Edit Person | HarvestGen',
};

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();
  const { id } = await params;
  const person = await getPersonById(id, churchId);
  
  if (!person) {
    notFound();
  }
  
  const [
    { data: tags },
    { data: fieldDefinitions },
    { data: households }
  ] = await Promise.all([
    supabase.from('tags').select('*').eq('church_id', churchId).order('name'),
    supabase.from('field_definitions').select('*').eq('church_id', churchId).order('position'),
    supabase.from('households').select('*').eq('church_id', churchId).order('name'),
  ]);

  return (
    <WorkspacePage>
      <Link href={`/people/${displayIdFor(person)}`} className="workspace-link mb-2"><ArrowLeft size={16} aria-hidden="true" /> Back to profile</Link>
      <PageHeader eyebrow="Directory" title={`Edit ${person.first_name} ${person.last_name}`} description="Manage contact details, household, tags, and other profile information." />
      <div className="max-w-5xl">
        <PersonForm
          person={person}
          tags={tags || []}
          fieldDefinitions={fieldDefinitions || []}
          households={households || []}
        />
      </div>
    </WorkspacePage>
  );
}
