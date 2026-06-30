import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { RegistrationForm } from '@/components/events/RegistrationForm';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Metadata } from 'next';
import { marked } from 'marked';

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
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

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event || event.status === 'draft') {
    notFound();
  }

  // Get approved registration count to compute spots remaining
  const supabase = createServiceClient();
  const { count: approvedCount } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('status', 'approved');

  const spotsRemaining = event.capacity ? Math.max(0, event.capacity - (approvedCount || 0)) : null;
  const isFull = spotsRemaining === 0;

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Banner */}
      <div className="w-full h-[300px] sm:h-[400px] bg-muted relative border-b border-border">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-teal-500/20 to-primary/40 flex items-center justify-center">
            <span className="text-6xl font-bold text-primary/30 uppercase">{event.name.charAt(0)}</span>
          </div>
        )}
        {/* Overlay gradient for readability if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-24 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Content (Left 2/3) */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-border/50 p-6 sm:p-10">
            {event.status === 'closed' && (
              <div className="bg-slate-100 text-slate-800 p-4 rounded-xl mb-6 font-medium text-center border border-slate-200">
                Registration for this event is now closed.
              </div>
            )}
            
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">{event.name}</h1>
            
            <div className="space-y-4 mb-10 text-slate-600">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Date and time</div>
                  <div>
                    {format(new Date(event.start_at), 'EEEE, MMMM d, yyyy h:mm a')}
                    {event.end_at && ` – ${format(new Date(event.end_at), 'h:mm a')}`}
                  </div>
                </div>
              </div>
              
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900">Location</div>
                    <div>{event.location}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="prose prose-slate max-w-none prose-a:text-primary hover:prose-a:text-primary/80">
              <h2 className="text-xl font-semibold border-b border-border pb-2 mb-4">About this event</h2>
              {event.description ? (
                <div dangerouslySetInnerHTML={{ __html: marked.parse(event.description) }} />
              ) : (
                <p className="text-slate-500 italic">No description provided.</p>
              )}
            </div>
          </div>

          {/* Registration Sidebar (Right 1/3) */}
          <div className="lg:sticky lg:top-8">
            <div className="bg-white rounded-3xl shadow-xl border border-border/50 overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b border-border/50">
                <div className="text-2xl font-bold text-slate-900">
                  {event.price > 0 ? `RM ${event.price.toFixed(2)}` : 'Free'}
                </div>
                {spotsRemaining !== null && (
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {isFull ? <span className="text-red-500 font-medium">Fully booked</span> : `${spotsRemaining} spots remaining`}
                  </div>
                )}
              </div>
              
              <div className="p-6">
                {event.status === 'closed' ? (
                  <div className="text-center text-slate-500 py-4">
                    Registration is closed
                  </div>
                ) : isFull ? (
                  <div className="text-center text-red-600 py-4 font-medium">
                    This event is full.
                  </div>
                ) : (
                  <RegistrationForm event={event as any} spotsRemaining={spotsRemaining} />
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
