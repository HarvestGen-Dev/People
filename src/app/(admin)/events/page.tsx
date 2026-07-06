// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  TicketCheck,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { CopyButton } from '@/components/events/CopyButton';
import { ShareEventButton } from '@/components/events/ShareEventButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EventWithStats } from '@/lib/types';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Events | HarvestGen',
};

const statusStyles: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-200 text-slate-700 border-slate-300',
  draft: 'bg-amber-100 text-amber-700 border-amber-200',
};

export default async function EventsPage() {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const supabase = createServiceClient();

  const [eventsRes, registrationsRes] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('church_id', churchId)
      .order('start_at', { ascending: false }),
    supabase
      .from('event_registrations')
      .select('event_id, status')
      .eq('church_id', churchId)
  ]);

  const { data: eventsData } = eventsRes;
  
  let events: EventWithStats[] = [];
  if (eventsData?.length) {
    const { data: registrations } = registrationsRes;

    const registrationsByEvent = (registrations || []).reduce<
      Record<string, { total: number; pending: number; approved: number }>
    >((result, registration) => {
      if (!result[registration.event_id]) {
        result[registration.event_id] = {
          total: 0,
          pending: 0,
          approved: 0,
        };
      }
      result[registration.event_id].total += 1;
      if (registration.status === 'pending_review') {
        result[registration.event_id].pending += 1;
      }
      if (registration.status === 'approved') {
        result[registration.event_id].approved += 1;
      }
      return result;
    }, {});

    events = eventsData.map((event) => ({
      ...event,
      registration_count: registrationsByEvent[event.id]?.total || 0,
      pending_count: registrationsByEvent[event.id]?.pending || 0,
      approved_count: registrationsByEvent[event.id]?.approved || 0,
      spots_remaining: event.capacity
        ? event.capacity - (registrationsByEvent[event.id]?.approved || 0)
        : null,
    }));
  }

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
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://people.harvestgen.org';

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Gatherings
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Events
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Publish registration pages, review payments, and welcome every
            attendee with a clear process.
          </p>
        </div>
        {canManage && (
          <Link href="/events/new">
            <Button className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800">
              <Plus className="mr-2 h-4 w-4" />
              New event
            </Button>
          </Link>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Published', publishedCount, CalendarDays, 'bg-emerald-100 text-emerald-700'],
          ['Registrations', totalRegistrations, Users, 'bg-sky-100 text-sky-700'],
          ['Awaiting review', pendingCount, TicketCheck, 'bg-amber-100 text-amber-700'],
        ].map(([label, value, StatIcon, color]) => {
          const Icon = StatIcon as typeof CalendarDays;
          return (
            <div
              key={String(label)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${String(color)}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-950">
                  {String(value)}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  {String(label)}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-20 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-950">
            Create your first event
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Launch a registration page for a camp, course, conference, or
            ministry gathering.
          </p>
          {canManage && (
            <Link href="/events/new">
              <Button className="mt-6 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800">
                Create event
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const publicLink = `${appUrl}/e/${event.slug}`;
            return (
              <article
                key={event.id}
                className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_24px_55px_-40px_rgba(6,78,59,0.5)]"
              >
                <Link
                  href={canManage ? `/events/${event.id}/edit` : publicLink}
                  className="relative block aspect-[16/8.5] overflow-hidden bg-emerald-950"
                >
                  {event.cover_image_url ? (
                    <img
                      src={event.cover_image_url}
                      alt={event.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="landing-grid grid h-full w-full place-items-center bg-gradient-to-br from-emerald-950 to-emerald-800">
                      <span className="text-6xl font-black uppercase text-emerald-300/35">
                        {event.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
                  <Badge
                    variant="outline"
                    className={`absolute left-4 top-4 capitalize shadow-sm ${statusStyles[event.status]}`}
                  >
                    {event.status}
                  </Badge>
                  {event.pending_count > 0 && (
                    <div className="absolute bottom-4 right-4 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-amber-950 shadow-sm">
                      {event.pending_count} to review
                    </div>
                  )}
                </Link>

                <div className="p-5">
                  <Link href={canManage ? `/events/${event.id}/edit` : publicLink}>
                    <h2 className="truncate text-xl font-bold tracking-tight text-slate-950 group-hover:text-emerald-700">
                      {event.name}
                    </h2>
                  </Link>
                  <div className="mt-4 space-y-2 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-600" />
                      {format(new Date(event.start_at), 'EEE, d MMM yyyy · h:mm a')}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span className="truncate">
                        {event.location || 'Location to be confirmed'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                      ['Registered', event.registration_count],
                      ['Approved', event.approved_count],
                      [
                        'Spots',
                        event.spots_remaining === null
                          ? '∞'
                          : Math.max(0, event.spots_remaining),
                      ],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                        <div className="font-bold text-slate-900">
                          {String(value)}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {String(label)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-1">
                      {event.status === 'published' && (
                        <>
                          <CopyButton textToCopy={publicLink} />
                          <ShareEventButton
                            eventName={event.name}
                            publicUrl={publicLink}
                            compact
                          />
                        </>
                      )}
                      {canManage && <Link href={`/events/${event.id}/registrations`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl font-bold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          Manage registrations
                        </Button>
                      </Link>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
