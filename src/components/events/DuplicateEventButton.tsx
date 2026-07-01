'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function DuplicateEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/duplicate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to duplicate event');
      
      const { data } = await res.json();
      toast.success('Event duplicated');
      router.push(`/events/${data.id}/edit`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate event');
      setIsDuplicating(false);
    }
  };

  return (
    <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating} className="cursor-pointer">
      {isDuplicating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
      Duplicate event
    </DropdownMenuItem>
  );
}
