import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, MapPin, Copy, ExternalLink, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { EventWithStats } from '@/lib/types';
import { cn } from '@/lib/utils';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Events | HarvestGen',
};

// Next.js client side copy wrapper component
import { CopyButton } from '@/components/events/CopyButton';

export default async function EventsPage() {
  const { churchId } = await requireTenantContext();
  const supabase = createServiceClient();

  // Manual query execution instead of raw SQL since Supabase JS doesn't easily let us execute raw string SQL
  // We fetch events and group counts manually if no RPC exists.
  const { data: eventsData, error } = await supabase
    .from('events')
    .select('*')
    .eq('church_id', churchId)
    .order('start_at', { ascending: false });

  let events: EventWithStats[] = [];

  if (eventsData && eventsData.length > 0) {
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('event_id, status')
      .eq('church_id', churchId);

    const regByEvent = (registrations || []).reduce<Record<
      string,
      { total: number; pending: number; approved: number }
    >>((acc, reg) => {
      if (!acc[reg.event_id]) {
        acc[reg.event_id] = { total: 0, pending: 0, approved: 0 };
      }
      acc[reg.event_id].total++;
      if (reg.status === 'pending_review') acc[reg.event_id].pending++;
      if (reg.status === 'approved') acc[reg.event_id].approved++;
      return acc;
    }, {});

    events = eventsData.map(e => ({
      ...e,
      registration_count: regByEvent[e.id]?.total || 0,
      pending_count: regByEvent[e.id]?.pending || 0,
      approved_count: regByEvent[e.id]?.approved || 0,
      spots_remaining: e.capacity ? e.capacity - (regByEvent[e.id]?.approved || 0) : null
    }));
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-500/90 text-white border-transparent';
      case 'closed': return 'bg-slate-700/90 text-white border-transparent';
      default: return 'bg-gray-500/90 text-white border-transparent';
    }
  };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://people.harvestgen.org';

  return (
    <>
      <Topbar title="Events">
        <Link href="/events/new">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl h-9 px-4 shadow-sm transition-all hover:shadow-md">
            <Plus className="h-4 w-4" />
            New event
          </Button>
        </Link>
      </Topbar>

      <div className="p-8 max-w-7xl mx-auto animate-in fade-in-50 duration-300">
        {events.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/30">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No events yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">Create your first event to start accepting registrations for camps, conferences, and courses.</p>
            <Link href="/events/new">
              <Button className="rounded-xl">Create Event</Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => {
              const publicLink = `${APP_URL}/e/${event.slug}`;
              return (
                <div key={event.id} className="group flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <Link href={`/events/${event.id}/edit`} className="block relative aspect-[16/9] w-full bg-muted overflow-hidden">
                    {event.cover_image_url ? (
                      <img src={event.cover_image_url} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-teal-500/20 to-primary/40 flex items-center justify-center">
                        <span className="text-5xl font-bold text-primary/30 uppercase">{event.name.charAt(0)}</span>
                      </div>
                    )}
                    <Badge className={cn("absolute top-3 left-3 shadow-sm capitalize backdrop-blur-sm", getStatusColor(event.status))}>
                      {event.status}
                    </Badge>
                  </Link>
                  
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex-1">
                      <Link href={`/events/${event.id}/edit`} className="block hover:underline">
                        <h3 className="text-xl font-bold text-foreground line-clamp-1 mb-2">{event.name}</h3>
                      </Link>
                      
                      <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {format(new Date(event.start_at), 'MMM d, yyyy')}
                            {event.end_at ? ` – ${format(new Date(event.end_at), 'MMM d, yyyy')}` : ''}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-foreground">{event.registration_count} registered</span>
                        {event.pending_count > 0 && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs animate-pulse">
                            {event.pending_count} pending
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {event.status === 'published' && (
                          <CopyButton textToCopy={publicLink} />
                        )}
                        <Link href={`/events/${event.id}/registrations`}>
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-primary hover:text-primary hover:bg-primary/10">
                            Registrations
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
