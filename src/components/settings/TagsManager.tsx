'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', 
  '#EC4899', '#0D9488', '#F97316', '#06B6D4', '#84CC16', '#14B8A6'
];

type TagData = {
  id: string;
  name: string;
  color: string;
  people_count: number;
};

export function TagsManager({ initialTags }: { initialTags: TagData[] }) {
  const [tags, setTags] = useState<TagData[]>(initialTags);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
  
  const [formData, setFormData] = useState({ name: '', color: PRESET_COLORS[0] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreate = () => {
    setFormData({ name: '', color: PRESET_COLORS[0] });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (tag: TagData) => {
    setFormData({ name: tag.name, color: tag.color });
    setEditingId(tag.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/admin/tags/${editingId}` : '/api/admin/tags';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save tag');
      const { data } = await res.json();

      if (editingId) {
        setTags(tags.map(t => t.id === editingId ? { ...t, ...data } : t));
        toast.success('Tag updated');
      } else {
        setTags([...tags, { ...data, people_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success('Tag created');
      }
      setIsDialogOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const tag = tags.find(t => t.id === id);
    if (!tag) return;
    
    if (tag.people_count > 0) {
      if (!confirm(`Warning: This tag is attached to ${tag.people_count} people. Deleting it will remove it from all of them. Are you sure?`)) return;
    } else {
      if (!confirm('Are you sure you want to delete this tag?')) return;
    }

    try {
      const res = await fetch(`/api/admin/tags/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tag');
      
      setTags(tags.filter(t => t.id !== id));
      toast.success('Tag deleted');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tag');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Organization
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">
            Tags
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Create consistent labels for segments, ministries, and follow-up needs.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800">
          <Plus className="h-4 w-4" /> New tag
        </Button>
      </header>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Tags and the number of people assigned to each tag</caption>
          <thead className="bg-slate-50/50 border-b border-border text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3 w-16 text-center">Color</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">People count</th>
              <th className="px-6 py-3 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tags.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No tags created yet.
                </td>
              </tr>
            ) : (
              tags.map(tag => (
                <tr key={tag.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="w-4 h-4 rounded-full mx-auto shadow-sm" style={{ backgroundColor: tag.color }} />
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900">{tag.name}</td>
                  <td className="px-6 py-3 text-slate-500">{tag.people_count}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <Button aria-label={`Edit ${tag.name}`} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-700" onClick={() => openEdit(tag)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button aria-label={`Delete ${tag.name}`} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(tag.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Tag' : 'New Tag'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            <div>
              <label htmlFor="tag-name" className="text-sm font-medium mb-1.5 block">Name</label>
              <Input 
                id="tag-name"
                autoFocus
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g. Volunteer" 
                className="rounded-xl"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full shadow-sm border-2 transition-all ${formData.color === color ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl shadow-sm">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Create tag'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
