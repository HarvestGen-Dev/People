'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Users, Sparkles, Folder, MoreVertical, Search, FileText } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function ListIndexManager({ initialLists, churchId }: { initialLists: any[], churchId: string }) {
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'smart' });

  const smartLists = lists.filter(l => l.type === 'smart');
  const staticLists = lists.filter(l => l.type === 'static');

  const openCreate = () => {
    setFormData({ name: '', type: 'smart' });
    setIsDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    // For smart lists, we go directly to the builder without saving first, 
    // or we save a blank one and go to it? The prompt says:
    // "For Smart lists → go to `/lists/new?type=smart`" 
    // Actually, maybe we just redirect with the name in URL, or create it first.
    // Prompt: "dialog just captures name and type ... For Smart lists → go to /lists/new?type=smart"
    router.push(`/lists/new?type=${formData.type}&name=${encodeURIComponent(formData.name)}`);
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this list?')) return;
    try {
      const res = await fetch(`/api/admin/lists/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete list');
      setLists(lists.filter(l => l.id !== id));
      toast.success('List deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const renderTable = (data: any[], type: 'smart' | 'static') => (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm mb-8">
      <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex items-center gap-2">
        {type === 'smart' ? <Sparkles className="h-5 w-5 text-amber-500" /> : <Folder className="h-5 w-5 text-teal-600" />}
        <h3 className="font-semibold text-slate-900">{type === 'smart' ? 'Smart lists' : 'Static lists'}</h3>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 border-b border-border text-slate-500 font-medium">
          <tr>
            <th className="px-6 py-3">Name</th>
            {type === 'smart' && <th className="px-6 py-3">Rules summary</th>}
            <th className="px-6 py-3">Members</th>
            <th className="px-6 py-3">Created</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={type === 'smart' ? 5 : 4} className="px-6 py-8 text-center text-slate-500">
                No {type} lists yet. Create one to segment your people.
              </td>
            </tr>
          ) : (
            data.map(l => (
              <tr key={l.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-3 font-medium text-slate-900">
                  <button onClick={() => router.push(`/lists/${l.id}`)} className="hover:underline">{l.name}</button>
                </td>
                {type === 'smart' && (
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {l.filters?.rules ? `${l.filters.rules.length} rule(s) (${l.filters.operator})` : 'No rules'}
                  </td>
                )}
                <td className="px-6 py-3 text-slate-600">
                  {type === 'static' ? (
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-xs border border-slate-200">
                      {l.member_count}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Dynamic (click to view)</span>
                  )}
                </td>
                <td className="px-6 py-3 text-slate-500 text-xs">
                  {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                </td>
                <td className="px-6 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-md hover:bg-slate-100 outline-none">
                      <MoreVertical className="h-4 w-4 text-slate-500" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 rounded-xl">
                      <DropdownMenuItem onClick={() => router.push(`/lists/${l.id}`)}>View</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/lists/${l.id}`)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(l.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Segments</h2>
          <p className="text-slate-500 text-sm mt-1">Organize your people into dynamic or static lists.</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl shadow-sm bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" /> New list
        </Button>
      </div>

      {renderTable(smartLists, 'smart')}
      {renderTable(staticLists, 'static')}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>New List</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">List name</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Active Volunteers" className="rounded-xl" autoFocus />
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium mb-1 block">List type</label>
              
              <label className={`flex p-3 border rounded-xl cursor-pointer transition-colors ${formData.type === 'smart' ? 'border-primary bg-primary/5' : 'border-border hover:bg-slate-50'}`}>
                <input type="radio" name="type" checked={formData.type === 'smart'} onChange={() => setFormData({ ...formData, type: 'smart' })} className="sr-only" />
                <div className="flex gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${formData.type === 'smart' ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                    {formData.type === 'smart' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Smart list
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">Automatically updates based on rules you define (e.g. everyone who is active and has the "Volunteer" tag).</div>
                  </div>
                </div>
              </label>

              <label className={`flex p-3 border rounded-xl cursor-pointer transition-colors ${formData.type === 'static' ? 'border-primary bg-primary/5' : 'border-border hover:bg-slate-50'}`}>
                <input type="radio" name="type" checked={formData.type === 'static'} onChange={() => setFormData({ ...formData, type: 'static' })} className="sr-only" />
                <div className="flex gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${formData.type === 'static' ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                    {formData.type === 'static' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900 flex items-center gap-1">
                      <Folder className="h-3.5 w-3.5 text-teal-600" /> Static list
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">A manual list where you hand-pick who belongs (e.g. attendees of a specific small group meeting).</div>
                  </div>
                </div>
              </label>

            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.name.trim()} className="rounded-xl shadow-sm">Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
