'use client';

// <!-- AGENT: FRONTEND -->
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

export function CompleteFollowUp({ id, name, focusTarget }: { id: string; name: string; focusTarget: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function complete() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/workflow-cards/${id}/complete`, { method: 'POST' });
        if (!response.ok) throw new Error('Completion failed');
        toast.success(`Follow-up completed for ${name}`);
        document.getElementById(focusTarget)?.focus({ preventScroll: true });
        router.refresh();
      } catch {
        toast.error('Could not complete this follow-up. Try again.');
      }
    });
  }

  return (
    <button type="button" className="workspace-button workspace-icon-button size-11 shrink-0 rounded-full p-0" onClick={complete}
      disabled={pending} aria-busy={pending} aria-label={`Complete follow-up for ${name}`} title="Mark complete">
      {pending ? <span aria-hidden="true">…</span> : <Check size={17} aria-hidden="true" />}
    </button>
  );
}
