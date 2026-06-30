import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, ExternalLink, MoreHorizontal, Copy, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Event } from '@/lib/types';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'Edit Event | HarvestGen',
};

// Client components for actions
import { DeleteEventButton } from '@/components/events/DeleteEventButton';
import { DuplicateEventButton } from '@/components/events/DuplicateEventButton';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient();
  const { id } = await params;
  
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error || !event) {
    notFound();
  }
  
  // Check if there are registrations to warn before deletion
  const { count } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id);

  const hasRegistrations = (count || 0) > 0;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-100 text-emerald-700 border-transparent';
      case 'closed': return 'bg-slate-100 text-slate-700 border-transparent';
      default: return 'bg-gray-100 text-gray-700 border-transparent';
    }
  };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://people.harvestgen.org';

  return (
    <>
      <Topbar title={event.name}>
        <div className="flex items-center gap-3">
          <Link href="/events" className="hidden sm:block">
            <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          
          <Badge className={cn("capitalize shadow-none px-2.5 py-0.5", getStatusColor(event.status))}>
            {event.status}
          </Badge>
          
          {event.status === 'published' && (
            <Link href={`${APP_URL}/e/${event.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="rounded-xl shadow-sm h-9 gap-2">
                View public page <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 w-9 p-0 items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-lg">
              <DuplicateEventButton eventId={event.id} />
              <DeleteEventButton eventId={event.id} hasRegistrations={hasRegistrations} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Topbar>

      <div className="p-8 max-w-5xl mx-auto animate-in fade-in-50 duration-300">
        <EventForm event={event as Event} />
      </div>
    </>
  );
}
