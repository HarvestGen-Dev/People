import { Topbar } from '@/components/layout/Topbar';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { requireTenantContext } from '@/lib/tenant-context';
import { createServiceClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'New Event | HarvestGen',
};

export default async function NewEventPage() {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, name')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name');

  return (
    <>
      <Topbar title="New Event">
        <Link href="/events">
          <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
          </Button>
        </Link>
      </Topbar>

      <div className="mx-auto max-w-6xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <EventForm workflows={workflows || undefined} />
      </div>
    </>
  );
}
