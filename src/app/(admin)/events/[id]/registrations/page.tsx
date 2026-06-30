import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RegistrationsTable } from '@/components/events/RegistrationsTable';

export const metadata = {
  title: 'Registrations | HarvestGen',
};

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient();
  const { id } = await params;

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, price')
    .eq('id', id)
    .single();

  if (eventError || !event) {
    notFound();
  }

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false });

  return (
    <>
      <Topbar title={`${event.name} — Registrations`}>
        <Link href="/events">
          <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
          </Button>
        </Link>
      </Topbar>

      <div className="p-8 max-w-7xl mx-auto animate-in fade-in-50 duration-300">
        <RegistrationsTable 
          registrations={registrations || []} 
          eventId={event.id}
          isFreeEvent={event.price === 0}
        />
      </div>
    </>
  );
}
