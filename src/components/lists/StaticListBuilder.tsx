'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function StaticListBuilder({ initialName }: { initialName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('List name is required');

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'static' })
      });
      
      if (!res.ok) throw new Error('Failed to create list');
      const { data } = await res.json();
      
      toast.success('Static list created');
      router.push(`/lists/${data.display_id || data.id}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create list');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl animate-in rounded-3xl border border-slate-200/80 bg-white p-6 shadow-none fade-in-50 sm:p-8">
      <div className="mb-7 flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100">
          <Folder className="h-5 w-5 text-sky-700" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Manual audience</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Create a static list</h2>
          <p className="mt-1 text-sm text-slate-500">Create the list first, then choose the people who belong.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">List name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Christmas Choir" className="h-11 rounded-xl bg-slate-50 shadow-none" autoFocus />
        </div>

        <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="h-11 w-full rounded-xl bg-emerald-700 font-bold shadow-sm hover:bg-emerald-800">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Create list and add people
        </Button>
      </div>
    </div>
  );
}
