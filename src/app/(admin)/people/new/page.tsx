import { createServiceClient } from '@/lib/supabase/server';
import { PersonForm } from '@/components/people/PersonForm';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
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
    <>
      <Topbar title="New Person">
        <div className="flex items-center gap-2">
          <Link href="/people">
            <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to People
            </Button>
          </Link>
        </div>
      </Topbar>

      <div className="p-8 max-w-5xl mx-auto animate-in fade-in-50 duration-300">
        <PersonForm 
          tags={tags || []} 
          fieldDefinitions={fieldDefinitions || []} 
          households={households || []} 
        />
      </div>
    </>
  );
}
