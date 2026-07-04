import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, ExternalLink, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Event } from '@/lib/types';
import { cn } from '@/lib/utils';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Edit Event | HarvestGen',
};

// Client components for actions
import { DeleteEventButton } from '@/components/events/DeleteEventButton';
import { DuplicateEventButton } from '@/components/events/DuplicateEventButton';
import { ShareEventButton } from '@/components/events/ShareEventButton';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();
  const { id } = await params;
  
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('church_id', churchId)
    .single();
    
  if (error || !event) {
    notFound();
  }
  
  // Check if there are registrations to warn before deletion
  const { count } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('church_id', churchId);

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, name')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name');

  const hasRegistrations = (count || 0) > 0;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-100 text-emerald-700 border-transparent';
      case 'closed': return 'bg-slate-100 text-slate-700 border-transparent';
      default: return 'bg-gray-100 text-gray-700 border-transparent';
    }
  };

  const reqHeaders = await headers();
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host');
  const proto = reqHeaders.get('x-forwarded-proto') || (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  const APP_URL = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'https://people.harvestgen.org');

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
            <>
              <ShareEventButton
                eventName={event.name}
                publicUrl={`${APP_URL}/e/${event.slug}`}
              />
              <Link href={`${APP_URL}/e/${event.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="rounded-xl shadow-sm h-9 gap-2">
                  View public page <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </>
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

      <div className="mx-auto max-w-6xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <EventForm event={event as Event} workflows={workflows || undefined} />
      </div>
    </>
  );
}
