import { Topbar } from '@/components/layout/Topbar';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'New Event | HarvestGen',
};

export default function NewEventPage() {
  return (
    <>
      <Topbar title="New Event">
        <Link href="/events">
          <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
          </Button>
        </Link>
      </Topbar>

      <div className="p-8 max-w-5xl mx-auto animate-in fade-in-50 duration-300">
        <EventForm />
      </div>
    </>
  );
}
