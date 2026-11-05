// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { headers } from 'next/headers';
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { EmptyState, PageHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { createServiceClient } from '@/lib/supabase/server';
import { CopyButton } from '@/components/events/CopyButton';
import { ShareEventButton } from '@/components/events/ShareEventButton';
import type { EventWithStats } from '@/lib/types';
import { requireTenantContext } from '@/lib/tenant-context';
import { displayIdFor } from '@/lib/display-ids';
import { createRequestPerformanceTracker } from '@/lib/performance';

export const metadata = {
  title: 'Events | HarvestGen',
};

export default async function EventsPage() {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const supabase = createServiceClient();
  const perf = createRequestPerformanceTracker('events-index');

  const eventsRes = await perf.track(
    'events.with_stats',
    supabase.rpc('get_event_index_with_stats', { p_church_id: churchId })
  );

  if (eventsRes.error) {
    throw eventsRes.error;
  }

  const events = ((eventsRes.data || []) as EventWithStats[]).map((event) => ({
    ...event,
    registration_count: Number(event.registration_count || 0),
    pending_count: Number(event.pending_count || 0),
    approved_count: Number(event.approved_count || 0),
    spots_remaining:
      event.spots_remaining === null ? null : Number(event.spots_remaining),
  }));

  const publishedCount = events.filter(
    (event) => event.status === 'published'
  ).length;
  const totalRegistrations = events.reduce(
    (sum, event) => sum + event.registration_count,
    0
  );
  const pendingCount = events.reduce(
    (sum, event) => sum + event.pending_count,
    0
  );
  const reqHeaders = await headers();
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host');
  const proto = reqHeaders.get('x-forwarded-proto') || (process.env.NODE_ENV === 'development' ? 'http' : 'https');
  const appUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'https://people.harvestgen.org');
  perf.log();

  const dateFormat = new Intl.DateTimeFormat('en-MY', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
  });
  const orderedEvents = [...events].sort((a, b) => canManage ? Number(b.pending_count > 0) - Number(a.pending_count > 0) : 0);

  return (
    <WorkspacePage>
      <PageHeader eyebrow="Gatherings" title="Events"
        description="Publish gatherings, review registrations, and welcome attendees."
        actions={canManage && <Link href="/events/new" className="workspace-button" data-primary><Plus size={16} aria-hidden="true" /> New event</Link>}
      />
      <dl className="workspace-panel workspace-metrics workspace-metrics-three" aria-label="Event totals">
        <div><dt>Published</dt><dd>{publishedCount}</dd></div>
        <div><dt>Registrations</dt><dd>{totalRegistrations}</dd></div>
        <div><dt>Awaiting review</dt><dd>{pendingCount}</dd></div>
      </dl>
      {orderedEvents.length === 0 ? (
        <section className="workspace-panel">
          <EmptyState title="No events yet" description={canManage ? 'Create an event to start collecting registrations.' : 'Events will appear here when your team creates them.'} />
        </section>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Events">
          {orderedEvents.map((event) => {
            const publicLink = `${appUrl}/e/${event.slug}`;
            const eventPath = `/events/${displayIdFor(event)}`;
            const eventHref = canManage ? `${eventPath}/edit` : publicLink;
            return (
              <li key={event.id} className="workspace-panel flex flex-col [overflow-wrap:anywhere]">
                {event.cover_image_url && (
                  <Link href={eventHref} className="block" aria-label={event.name} tabIndex={-1}>
                    <img src={event.cover_image_url} alt="" loading="lazy" className="aspect-[3/1] w-full rounded-t-[.7rem] object-cover" />
                  </Link>
                )}
                <div className="flex grow flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="directory-status" data-status={event.status === 'published' ? 'active' : 'inactive'}>{event.status}</span>
                    {event.pending_count > 0 && (
                      canManage ? <Link href={`${eventPath}/registrations?status=pending_review`} className="workspace-attention inline-flex min-h-11 items-center hover:underline">
                        {event.pending_count} to review
                      </Link> : <span className="workspace-attention">{event.pending_count} to review</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold"><Link href={eventHref} className="workspace-row-link">{event.name}</Link></h2>
                    <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      <p className="flex items-start gap-2"><CalendarDays size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <time dateTime={event.start_at}>{dateFormat.format(new Date(event.start_at))}</time>
                      </p>
                      <p className="flex items-start gap-2"><MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                        {event.location || 'Location to be confirmed'}
                      </p>
                    </div>
                  </div>
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div className="flex flex-row-reverse gap-1.5"><dt>registered</dt><dd className="font-semibold text-foreground">{event.registration_count}</dd></div>
                    <div className="flex flex-row-reverse gap-1.5"><dt>approved</dt><dd className="font-semibold text-foreground">{event.approved_count}</dd></div>
                    <div className="flex gap-1.5"><dt>Spots:</dt><dd className="font-semibold text-foreground">{event.spots_remaining === null ? 'Unlimited' : Math.max(0, event.spots_remaining)}</dd></div>
                  </dl>
                  {(canManage || event.status === 'published') && <div className="workspace-actions mt-auto border-t pt-3">
                    {canManage && <Link href={`${eventPath}/registrations`} className="workspace-link">Manage registrations</Link>}
                    {event.status === 'published' && <><CopyButton textToCopy={publicLink} /><ShareEventButton eventName={event.name} publicUrl={publicLink} compact /></>}
                  </div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspacePage>
  );
}
