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
      router.push(`/lists/${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-border p-6 rounded-2xl shadow-sm max-w-xl animate-in fade-in-50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
          <Folder className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">New Static List</h2>
          <p className="text-sm text-slate-500">Create a list to manually add people to.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">List Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Christmas Choir" className="rounded-xl" autoFocus />
        </div>

        <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="rounded-xl shadow-sm bg-primary hover:bg-primary/90 w-full">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Create list and add people
        </Button>
      </div>
    </div>
  );
}
