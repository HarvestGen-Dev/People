'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { startNavigationProgress } from '@/lib/navigation-progress';

export function DeleteEventButton({ eventId, hasRegistrations }: { eventId: string, hasRegistrations: boolean }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const warning = hasRegistrations 
      ? 'WARNING: This event already has registrations. Deleting it will permanently delete all registrations associated with it. Are you absolutely sure?' 
      : 'Are you sure you want to delete this event? This action cannot be undone.';
      
    if (!confirm(warning)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete event');
      
      toast.success('Event deleted');
      startNavigationProgress();
      router.push('/events');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete event');
      setIsDeleting(false);
    }
  };

  return (
    <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
      Delete event
    </DropdownMenuItem>
  );
}
