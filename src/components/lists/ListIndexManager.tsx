'use client';

// <!-- AGENT: FRONTEND -->
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { startNavigationProgress } from '@/lib/navigation-progress';

export function CreateListButton() {
  const router = useRouter();

  return (
    <Dialog>
      <DialogTrigger className="workspace-button" data-primary>
        <Plus size={16} aria-hidden="true" /> New list
      </DialogTrigger>
      <DialogContent className="people-workspace rounded-xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Create a list</DialogTitle></DialogHeader>
        <form onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = String(data.get('name') ?? '').trim();
          const type = data.get('type') === 'static' ? 'static' : 'smart';
          if (!name) return;
          startNavigationProgress();
          router.push(`/lists/new?${new URLSearchParams({ type, name })}`);
        }} className="space-y-4">
          <label className="grid gap-1.5 text-sm font-semibold">List name
            <input name="name" required autoFocus className="min-h-11 rounded-lg border border-input px-3 text-base font-normal" />
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">List type</legend>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm">
              <input type="radio" name="type" value="smart" defaultChecked /> Smart — updates from matching rules
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm">
              <input type="radio" name="type" value="static" /> Static — people you choose
            </label>
          </fieldset>
          <div className="flex justify-end"><button type="submit" className="workspace-button" data-primary>Continue</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteListButton({ listId, name }: { listId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" className="workspace-link workspace-icon-button shrink-0 text-destructive" aria-label={`Delete ${name}`} title="Delete list"
      disabled={pending} onClick={() => {
        if (!confirm(`Delete “${name}”?`)) return;
        startTransition(async () => {
          try {
            const response = await fetch(`/api/admin/lists/${listId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete list');
            toast.success('List deleted');
            router.refresh();
          } catch {
            toast.error('Could not delete this list. Try again.');
          }
        });
      }}>
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}
