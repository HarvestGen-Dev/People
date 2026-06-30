'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Plus, Search, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function StaticListDetail({ list, people }: { list: any, people: any[] }) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleExport = () => {
    window.open(`/api/admin/lists/${list.id}/export`, '_blank');
  };

  const removePerson = async (personId: string) => {
    try {
      const res = await fetch(`/api/admin/lists/${list.id}/people/${personId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove person');
      toast.success('Removed from list');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/v1/people?search=${encodeURIComponent(searchQuery)}&per_page=20`, {
        // Use an internal API route for searching if API key auth is tricky, 
        // or just fetch from an admin route. 
        // Wait! `/api/v1/people` requires API key. I shouldn't call it from the browser without the key.
        // I will just use a server action or a new admin endpoint for search, but let's assume we have an admin endpoint or use Supabase client directly since it's a client component with RLS? 
        // The prompt says "Add people button opens a people search Dialog". I'll call an admin search endpoint.
      });
      // Actually, since I don't have an admin search endpoint yet, I will create one or just use Supabase.
    } catch (e) {
      // ignore
    }
  };

  // The easiest way is to just call Supabase directly from the client component!
  // Wait, I don't have createBrowserClient imported.
  // Let me just create a quick search endpoint at `/api/admin/people/search` or call it.
  
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/people/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const { data } = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddPeople = async () => {
    if (selectedIds.size === 0) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/admin/lists/${list.id}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error('Failed to add people');
      toast.success(`Added ${selectedIds.size} people`);
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{list.name}</h2>
          <p className="text-slate-500 text-sm">{people.length} people</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="rounded-xl bg-white shadow-sm gap-2">
            <Plus className="h-4 w-4" /> Add people
          </Button>
          <Button onClick={handleExport} className="rounded-xl shadow-sm gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-border text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Phone</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  This list is empty. Add people to get started.
                </td>
              </tr>
            ) : (
              people.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-3 font-medium text-slate-900">{p.first_name} {p.last_name}</td>
                  <td className="px-6 py-3 text-slate-600 capitalize">{p.status}</td>
                  <td className="px-6 py-3 text-slate-500">{p.email || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">{p.phone || '-'}</td>
                  <td className="px-6 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => removePerson(p.id)} className="text-destructive opacity-0 group-hover:opacity-100 h-8 hover:bg-destructive/10">
                      Remove
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add people to {list.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by name or email..." 
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  performSearch(e.target.value);
                }}
                className="pl-9 rounded-xl"
              />
            </div>
            
            <div className="border border-border rounded-xl h-64 overflow-y-auto bg-slate-50/50">
              {isSearching ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex justify-center items-center h-full text-sm text-slate-500">
                  {searchQuery ? 'No results found' : 'Type to search people'}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {searchResults.map(p => {
                    const inList = people.some(existing => existing.id === p.id);
                    const selected = selectedIds.has(p.id);
                    return (
                      <li key={p.id} className={`flex items-center justify-between p-3 ${inList ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'} transition-colors`} onClick={() => !inList && toggleSelect(p.id)}>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{p.first_name} {p.last_name}</div>
                          <div className="text-xs text-slate-500">{p.email}</div>
                        </div>
                        {inList ? (
                          <span className="text-xs font-medium text-slate-500">In list</span>
                        ) : (
                          <input type="checkbox" checked={selected} readOnly className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary pointer-events-none" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSearchOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddPeople} disabled={selectedIds.size === 0 || isAdding} className="rounded-xl shadow-sm">
              {isAdding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Add {selectedIds.size} people
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
