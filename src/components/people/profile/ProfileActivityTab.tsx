import { format } from 'date-fns';
import { Activity, BookOpen, Coffee, User, Users } from 'lucide-react';
import type { PersonEvent } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';

const getEventIcon = (source: string) => {
  switch (source) {
    case 'shepherd': return <BookOpen className="h-5 w-5 text-indigo-500" />;
    case 'drip_brew': return <Coffee className="h-5 w-5 text-amber-600" />;
    case 'manual': return <User className="h-5 w-5 text-slate-500" />;
    case 'people': return <Users className="h-5 w-5 text-emerald-500" />;
    default: return <Activity className="h-5 w-5 text-primary" />;
  }
};

const formatEventName = (eventType: string) => {
  return eventType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export function ProfileActivityTab({ events }: { events: PersonEvent[] }) {
  return (
    <TabsContent value="activity" className="animate-in fade-in-50 duration-300">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Timeline Activity</CardTitle>
          <CardDescription>A chronological view of all events from connected integrations and the CRM.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center text-muted-foreground">
              <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p>No activity yet.</p>
              <p className="mt-1 text-sm">Events from Shepherd and Drip & Brew will appear here automatically.</p>
            </div>
          ) : (
            <div className="relative ml-4 space-y-8 border-l-2 border-emerald-100 py-2 pl-6">
              {events.map(event => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[35px] top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-100 bg-white">
                    {getEventIcon(event.source)}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-base font-semibold text-foreground">
                        {formatEventName(event.event_type)}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{format(new Date(event.occurred_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <Badge variant="secondary" className="mb-3 bg-muted text-xs font-medium capitalize shadow-none">{event.source.replace('_', ' ')}</Badge>
                    
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="rounded-lg bg-muted/40 p-3 font-mono text-sm text-muted-foreground">
                        {Object.entries(event.metadata).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="font-semibold text-slate-500">{k}:</span>
                            <span className="text-slate-700">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
