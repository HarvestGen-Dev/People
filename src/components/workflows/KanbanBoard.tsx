'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, MoreHorizontal, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { WorkflowCardComponent } from './WorkflowCard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  ListPerson,
  Workflow,
  WorkflowAdminUser,
  WorkflowBoardCard,
  WorkflowCard,
  WorkflowStep,
} from '@/lib/types';

// <!-- AGENT: FRONTEND -->
// DECISION: Skipped @dnd-kit implementation as permitted by instructions to save complexity. 
// Cards can be moved between columns via the "Move to step" dropdown in the card drawer.

type WorkflowCardUpdate = Partial<
  Pick<WorkflowCard, 'current_step_id' | 'assigned_to' | 'due_date' | 'notes'>
>;

interface KanbanBoardProps {
  workflow: Workflow;
  initialSteps: WorkflowStep[];
  initialCards: WorkflowBoardCard[];
  users: WorkflowAdminUser[];
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

export function KanbanBoard({ workflow, initialSteps, initialCards, users }: KanbanBoardProps) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [cards, setCards] = useState(initialCards);

  const [activeCard, setActiveCard] = useState<WorkflowBoardCard | null>(null);
  
  // Step Add
  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);

  // Card Add
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [targetStepId, setTargetStepId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [cardFormData, setCardFormData] = useState({ assigned_to: '', due_date: '', notes: '' });

  const performSearch = async (q: string) => {
    if (!q) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/admin/people/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const { data } = await res.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const handleAddStep = async () => {
    if (!newStepName.trim()) return;
    try {
      const currentIndex = steps.findIndex(s => s.id === insertAfterId);
      const pos1 = currentIndex >= 0 ? steps[currentIndex].position : 0;
      const pos2 = currentIndex + 1 < steps.length ? steps[currentIndex + 1].position : pos1 + 1000;
      const position = insertAfterId ? pos1 + (pos2 - pos1) / 2 : 1000; // naive mid-point

      const res = await fetch('/api/admin/workflow-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: workflow.id, name: newStepName, position })
      });
      if (!res.ok) throw new Error('Failed to create step');
      toast.success('Step added');
      setIsAddStepOpen(false);
      setNewStepName('');
      router.refresh();
      // Optionally we can push the step locally for immediate feedback but router.refresh() handles it.
      // But we need to wait for refresh or just reload page. Let's do reload for now since refresh might take a sec.
      window.location.reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const stepCards = cards.filter(c => c.current_step_id === stepId && !c.completed_at);
    if (stepCards.length > 0) return toast.error('Cannot delete a step with active cards');
    if (!confirm('Delete this step?')) return;
    try {
      await fetch(`/api/admin/workflow-steps/${stepId}`, { method: 'DELETE' });
      toast.success('Step deleted');
      window.location.reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleAddCard = async () => {
    if (!selectedPersonId || !targetStepId) return;
    try {
      const res = await fetch('/api/admin/workflow-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          current_step_id: targetStepId,
          person_id: selectedPersonId,
          ...cardFormData
        })
      });
      if (!res.ok) throw new Error('Failed to add card');
      toast.success('Card added');
      setIsAddCardOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPersonId(null);
      setCardFormData({ assigned_to: '', due_date: '', notes: '' });
      window.location.reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleUpdateCard = async (updates: WorkflowCardUpdate) => {
    if (!activeCard) return;
    try {
      const res = await fetch(`/api/admin/workflow-cards/${activeCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update card');
      toast.success('Card updated');
      setActiveCard({ ...activeCard, ...updates });
      window.location.reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleCompleteCard = async () => {
    if (!activeCard) return;
    try {
      const res = await fetch(`/api/admin/workflow-cards/${activeCard.id}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to complete card');
      toast.success('Marked as done');
      setActiveCard(null);
      window.location.reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleRemoveCard = async () => {
    if (!activeCard || !confirm('Remove this card?')) return;
    try {
      await fetch(`/api/admin/workflow-cards/${activeCard.id}`, { method: 'DELETE' });
      toast.success('Card removed');
      setActiveCard(null);
      window.location.reload();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const renderColumn = (step: Pick<WorkflowStep, 'id' | 'name'>, isDone = false) => {
    const columnCards = isDone
      ? cards.filter(c => c.completed_at)
      : cards.filter(c => c.current_step_id === step.id && !c.completed_at);
      
    return (
      <div key={step.id || 'done'} className="w-[320px] shrink-0 flex flex-col max-h-full">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{step.name}</h3>
            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
              {columnCards.length}
            </span>
          </div>
          {!isDone && (
            <DropdownMenu>
              <DropdownMenuTrigger className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center outline-none">
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl">
                <DropdownMenuItem onClick={() => { setInsertAfterId(step.id); setIsAddStepOpen(true); }}>Add step after</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeleteStep(step.id)} className="text-destructive focus:text-destructive">Delete step</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4 scrollbar-thin">
          {columnCards.map(c => (
            <WorkflowCardComponent key={c.id} card={c} onClick={() => setActiveCard(c)} />
          ))}

          {!isDone && (
            <Button 
              variant="ghost" 
              className="w-full justify-start text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-xl mt-1 h-10"
              onClick={() => { setTargetStepId(step.id); setIsAddCardOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-2" /> Add card
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in-50">
      <div className="flex-1 overflow-x-auto p-8 scrollbar-thin">
        <div className="flex gap-6 h-full pb-4">
          {steps.map(step => renderColumn(step))}
          {renderColumn({ id: 'done', name: 'Done' }, true)}

          {steps.length === 0 && (
            <div className="w-[320px] shrink-0 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-6 h-64 mt-8">
              <p className="text-sm text-slate-500 mb-4">No steps yet</p>
              <Button onClick={() => { setInsertAfterId(null); setIsAddStepOpen(true); }} variant="outline" className="rounded-xl">Add first step</Button>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over drawer for active card */}
      {activeCard && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setActiveCard(null)} />
          <div className="w-[400px] bg-white h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="p-6 border-b border-border bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Card details</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveCard(null)}>Close</Button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="flex items-center gap-4 bg-slate-50 border border-border p-4 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0">
                  {activeCard.people.photo_url && (
                    <img
                      src={activeCard.people.photo_url}
                      alt={`${activeCard.people.first_name} ${activeCard.people.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{activeCard.people.first_name} {activeCard.people.last_name}</div>
                  <Button variant="link" className="h-auto p-0 text-primary text-sm" onClick={() => router.push(`/people/${activeCard.people.id}`)}>View profile</Button>
                </div>
              </div>

              {!activeCard.completed_at && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Current step</label>
                  <Select value={activeCard.current_step_id ?? ''} onValueChange={v => handleUpdateCard({ current_step_id: v })}>
                    <SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {steps.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block">Assigned to</label>
                <Select value={activeCard.assigned_to || 'unassigned'} onValueChange={v => handleUpdateCard({ assigned_to: v === 'unassigned' ? null : v })}>
                  <SelectTrigger className="rounded-xl bg-white"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>User {u.user_id.slice(0, 5)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Due date</label>
                <Input type="date" value={activeCard.due_date ? activeCard.due_date.split('T')[0] : ''} onChange={e => handleUpdateCard({ due_date: e.target.value || null })} className="rounded-xl" />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Notes</label>
                <Textarea value={activeCard.notes || ''} onChange={e => handleUpdateCard({ notes: e.target.value })} placeholder="Add follow-up notes..." className="rounded-xl min-h-[100px]" />
              </div>
            </div>

            <div className="p-6 border-t border-border bg-slate-50 space-y-3">
              {!activeCard.completed_at ? (
                <Button onClick={handleCompleteCard} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Mark as done
                </Button>
              ) : (
                <div className="text-center text-sm font-medium text-emerald-600 mb-2">
                  <CheckCircle2 className="h-5 w-5 inline mr-1" /> Completed
                </div>
              )}
              <Button onClick={handleRemoveCard} variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">Remove from workflow</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={isAddStepOpen} onOpenChange={setIsAddStepOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Add step</DialogTitle></DialogHeader>
          <div className="py-4"><Input value={newStepName} onChange={e => setNewStepName(e.target.value)} placeholder="Step name" className="rounded-xl" autoFocus /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddStepOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStep} disabled={!newStepName.trim()}>Add step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Add card</DialogTitle></DialogHeader>
          <div className="py-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input placeholder="Search person..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); performSearch(e.target.value); }} className="pl-9 rounded-xl" />
            </div>
            {searchResults.length > 0 && !selectedPersonId && (
              <div className="border border-border rounded-xl max-h-40 overflow-y-auto">
                {searchResults.map(p => (
                  <div key={p.id} className="p-2 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setSelectedPersonId(p.id); setSearchQuery(`${p.first_name} ${p.last_name}`); setSearchResults([]); }}>
                    {p.first_name} {p.last_name} <span className="text-slate-400 ml-2">{p.email}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedPersonId && (
              <>
                <Textarea placeholder="Notes (optional)" value={cardFormData.notes} onChange={e => setCardFormData({ ...cardFormData, notes: e.target.value })} className="rounded-xl" />
                <Input type="date" value={cardFormData.due_date} onChange={e => setCardFormData({ ...cardFormData, due_date: e.target.value })} className="rounded-xl" />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddCardOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCard} disabled={!selectedPersonId}>Add card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
