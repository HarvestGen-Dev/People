// <!-- AGENT: FRONTEND -->
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { marked } from 'marked';
import { createServiceClient } from '@/lib/supabase/server';
import { RegistrationForm } from '@/components/events/RegistrationForm';
import type { Event } from '@/lib/types';

async function getEventBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !event) return null;
  return event;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return {
    title: event ? `${event.name} | HarvestGen` : 'Event not found',
    description: event?.description?.slice(0, 160),
    openGraph: {
      images: event?.cover_image_url ? [event.cover_image_url] : [],
    },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event || event.status === 'draft') {
    notFound();
  }

  const supabase = createServiceClient();
  const { count: approvedCount } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('status', 'approved');

  const spotsRemaining = event.capacity
    ? Math.max(0, event.capacity - (approvedCount || 0))
    : null;
  const isFull = spotsRemaining === 0;

  return (
    <div className="min-h-screen bg-[#f5f7f3] text-slate-950">
      <header className="border-b border-white/10 bg-emerald-950 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-[10px] font-black text-emerald-950">
              HG
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-300">
                HarvestGen
              </div>
              <div className="text-sm font-bold">Events</div>
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-100/55">
            Secure registration
          </div>
        </div>
      </header>

      <section className="relative h-[300px] overflow-hidden bg-emerald-950 sm:h-[430px]">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="landing-grid grid h-full w-full place-items-center bg-gradient-to-br from-emerald-950 to-emerald-700">
            <span className="text-8xl font-black uppercase text-emerald-300/25">
              {event.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-5 pb-10 sm:px-8 sm:pb-14">
          <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100 backdrop-blur">
            Harvest Generation Church
          </div>
          <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-[-0.04em] text-white sm:text-6xl">
            {event.name}
          </h1>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            {event.status === 'closed' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold text-slate-700">
                Registration for this event is now closed.
              </div>
            )}

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CalendarDays className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Date and time
                  </div>
                  <div className="mt-2 text-sm font-bold leading-6 text-slate-900">
                    {format(
                      new Date(event.start_at),
                      'EEEE, d MMMM yyyy · h:mm a'
                    )}
                    {event.end_at &&
                      ` – ${format(new Date(event.end_at), 'h:mm a')}`}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700">
                  <MapPin className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Location
                  </div>
                  <div className="mt-2 text-sm font-bold leading-6 text-slate-900">
                    {event.location || 'Location to be confirmed'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="mb-6 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                About this event
              </div>
              {event.description ? (
                <div
                  className="prose prose-slate max-w-none prose-headings:tracking-tight prose-a:text-emerald-700"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(event.description),
                  }}
                />
              ) : (
                <p className="text-slate-500">
                  More event information will be shared soon.
                </p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              {[
                [CheckCircle2, 'Simple registration'],
                [ShieldCheck, 'Secure submission'],
                [Users, 'Confirmation by email'],
              ].map(([FeatureIcon, label]) => {
                const Icon = FeatureIcon as typeof Users;
                return (
                  <div
                    key={String(label)}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500"
                  >
                    <Icon className="h-4 w-4 text-emerald-600" />
                    {String(label)}
                  </div>
                );
              })}
            </section>
          </div>

          <aside className="lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-100 bg-slate-50/70 p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Registration
                    </div>
                    <div className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                      {event.price > 0
                        ? `RM ${event.price.toFixed(2)}`
                        : 'Free'}
                    </div>
                  </div>
                  {spotsRemaining !== null && (
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        isFull
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isFull ? 'Fully booked' : `${spotsRemaining} left`}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6">
                {event.status === 'closed' ? (
                  <div className="py-8 text-center">
                    <CalendarDays className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-500">
                      Registration is closed
                    </p>
                  </div>
                ) : isFull ? (
                  <div className="py-8 text-center">
                    <Users className="mx-auto h-7 w-7 text-red-300" />
                    <p className="mt-3 text-sm font-semibold text-red-600">
                      This event is fully booked
                    </p>
                  </div>
                ) : (
                  <RegistrationForm
                    event={event as Event}
                    spotsRemaining={spotsRemaining}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs font-medium text-slate-400">
        Harvest Generation Church · Event registration powered by People
      </footer>
    </div>
  );
}
