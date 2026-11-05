import { createServiceClient } from '@/lib/supabase/server';
import { PersonForm } from '@/components/people/PersonForm';
import { PageHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'New Person | HarvestGen',
};

export default async function NewPersonPage() {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

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
      <Link href="/people" className="workspace-link mb-2"><ArrowLeft size={16} aria-hidden="true" /> Back to directory</Link>
      <PageHeader eyebrow="Directory" title="Add person" description="Manage contact details, household, tags, and other profile information." />
      <div className="max-w-5xl">
        <PersonForm
          tags={tags || []}
          fieldDefinitions={fieldDefinitions || []}
          households={households || []}
        />
      </div>
    </WorkspacePage>
  );
}
