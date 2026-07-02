'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Plus, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { List, ListPerson } from '@/lib/types';
import { ListPeopleTable } from './ListPeopleTable';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';

export function StaticListDetail({
  list,
  people,
}: {
  list: List;
  people: ListPerson[];
}) {
  const router = useRouter();
  const { canManage } = useAdminPermissions();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListPerson[]>([]);
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove person');
    }
  };

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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Search failed');
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to add people');
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
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Static list</div>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{list.name}</h2>
          <p className="mt-2 text-sm text-slate-500">{people.length} manually selected people</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canManage && (
            <Button variant="outline" onClick={() => setIsSearchOpen(true)} className="rounded-xl bg-white shadow-sm gap-2">
              <Plus className="h-4 w-4" /> Add people
            </Button>
          )}
          <Button onClick={handleExport} className="rounded-xl bg-emerald-700 font-bold shadow-sm hover:bg-emerald-800 gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <ListPeopleTable
        people={people}
        emptyMessage="This list is empty. Add people to get started."
        onRemove={canManage ? removePerson : undefined}
      />

      {canManage && <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add people to {list.name}</DialogTitle>
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
                className="h-11 rounded-xl pl-9"
              />
            </div>
            
            <div className="h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/50">
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
                      <li key={p.id} className={`flex items-center justify-between p-3.5 ${inList ? 'opacity-50 bg-slate-50' : 'hover:bg-emerald-50 cursor-pointer'} transition-colors`} onClick={() => !inList && toggleSelect(p.id)}>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{p.first_name} {p.last_name}</div>
                          <div className="text-xs text-slate-500">{p.email}</div>
                        </div>
                        {inList ? (
                          <span className="text-xs font-medium text-slate-500">In list</span>
                        ) : (
                          <input type="checkbox" placeholder="Select" checked={selected} readOnly className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary pointer-events-none" />
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
      </Dialog>}
    </div>
  );
}
