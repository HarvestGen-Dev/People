import { createServiceClient } from '@/lib/supabase/server';
import { PersonForm } from '@/components/people/PersonForm';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
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
    <>
      <Topbar title={`Edit ${person.first_name} ${person.last_name}`}>
        <div className="flex items-center gap-2">
          <Link href={`/people/${displayIdFor(person)}`}>
            <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </Link>
        </div>
      </Topbar>

      <div className="p-8 max-w-5xl mx-auto animate-in fade-in-50 duration-300">
        <PersonForm 
          person={person}
          tags={tags || []} 
          fieldDefinitions={fieldDefinitions || []} 
          households={households || []} 
        />
      </div>
    </>
  );
}
