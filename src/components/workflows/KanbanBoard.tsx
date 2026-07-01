'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CircleDot,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowCardComponent } from './WorkflowCard';
import type {
  ListPerson,
  Workflow,
  WorkflowAdminUser,
  WorkflowBoardCard,
  WorkflowCard,
  WorkflowStep,
} from '@/lib/types';

type WorkflowCardUpdate = Partial<
  Pick<WorkflowCard, 'current_step_id' | 'assigned_to' | 'due_date' | 'notes'>
>;

interface KanbanBoardProps {
  workflow: Workflow;
  initialSteps: WorkflowStep[];
  initialCards: WorkflowBoardCard[];
  users: WorkflowAdminUser[];
}

interface CardDraft {
  current_step_id: string;
  assigned_to: string;
  due_date: string;
  notes: string;
}

const emptyDraft: CardDraft = {
  current_step_id: '',
  assigned_to: 'unassigned',
  due_date: '',
  notes: '',
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

export function KanbanBoard({
  workflow,
  initialSteps: steps,
  initialCards: cards,
  users,
}: KanbanBoardProps) {
  const router = useRouter();
  const [activeCard, setActiveCard] = useState<WorkflowBoardCard | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft>(emptyDraft);
  const [isSavingCard, setIsSavingCard] = useState(false);

  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [targetStepId, setTargetStepId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [cardFormData, setCardFormData] = useState({
    assigned_to: 'unassigned',
    due_date: '',
    notes: '',
  });

  const activeCount = cards.filter((card) => !card.completed_at).length;
  const completedCount = cards.filter((card) => card.completed_at).length;

  const openCard = (card: WorkflowBoardCard) => {
    setActiveCard(card);
    setCardDraft({
      current_step_id: card.current_step_id || '',
      assigned_to: card.assigned_to || 'unassigned',
      due_date: card.due_date ? card.due_date.split('T')[0] : '',
      notes: card.notes || '',
    });
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/people/search?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const { data } = await response.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const handleAddStep = async () => {
    if (!newStepName.trim()) return;
    try {
      const currentIndex = steps.findIndex((step) => step.id === insertAfterId);
      const previousPosition =
        currentIndex >= 0 ? steps[currentIndex].position : 0;
      const nextPosition =
        currentIndex + 1 < steps.length
          ? steps[currentIndex + 1].position
          : previousPosition + 1000;
      const position = insertAfterId
        ? previousPosition + (nextPosition - previousPosition) / 2
        : 1000;

      const response = await fetch('/api/admin/workflow-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          name: newStepName,
          position,
        }),
      });
      if (!response.ok) throw new Error('Failed to create step');
      toast.success('Step added');
      setIsAddStepOpen(false);
      setNewStepName('');
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const stepCards = cards.filter(
      (card) => card.current_step_id === stepId && !card.completed_at
    );
    if (stepCards.length > 0) {
      toast.error('Move or complete active cards before deleting this step');
      return;
    }
    if (!confirm('Delete this workflow step?')) return;
    try {
      const response = await fetch(`/api/admin/workflow-steps/${stepId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete step');
      toast.success('Step deleted');
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleAddCard = async () => {
    if (!selectedPersonId || !targetStepId) return;
    try {
      const response = await fetch('/api/admin/workflow-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          current_step_id: targetStepId,
          person_id: selectedPersonId,
          assigned_to:
            cardFormData.assigned_to === 'unassigned'
              ? null
              : cardFormData.assigned_to,
          due_date: cardFormData.due_date || null,
          notes: cardFormData.notes || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to add card');
      toast.success('Person added to workflow');
      setIsAddCardOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPersonId(null);
      setCardFormData({
        assigned_to: 'unassigned',
        due_date: '',
        notes: '',
      });
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleUpdateCard = async () => {
    if (!activeCard) return;
    setIsSavingCard(true);
    const updates: WorkflowCardUpdate = {
      current_step_id: cardDraft.current_step_id || null,
      assigned_to:
        cardDraft.assigned_to === 'unassigned'
          ? null
          : cardDraft.assigned_to,
      due_date: cardDraft.due_date || null,
      notes: cardDraft.notes || null,
    };
    try {
      const response = await fetch(
        `/api/admin/workflow-cards/${activeCard.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (!response.ok) throw new Error('Failed to update card');
      toast.success('Card updated');
      setActiveCard({ ...activeCard, ...updates });
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleCompleteCard = async () => {
    if (!activeCard) return;
    try {
      const response = await fetch(
        `/api/admin/workflow-cards/${activeCard.id}/complete`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to complete card');
      toast.success('Marked as complete');
      setActiveCard(null);
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleRemoveCard = async () => {
    if (!activeCard || !confirm('Remove this person from the workflow?')) return;
    try {
      const response = await fetch(
        `/api/admin/workflow-cards/${activeCard.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to remove card');
      toast.success('Removed from workflow');
      setActiveCard(null);
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const renderColumn = (
    step: Pick<WorkflowStep, 'id' | 'name'>,
    isDone = false
  ) => {
    const columnCards = isDone
      ? cards.filter((card) => card.completed_at)
      : cards.filter(
          (card) => card.current_step_id === step.id && !card.completed_at
        );

    return (
      <section
        key={step.id || 'done'}
        className="flex max-h-full w-[86vw] max-w-[340px] shrink-0 flex-col rounded-3xl border border-slate-200/80 bg-slate-100/70 p-3 sm:w-[320px]"
      >
        <header className="mb-3 flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isDone ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
            <h2 className="font-bold text-slate-900">{step.name}</h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
              {columnCards.length}
            </span>
          </div>
          {!isDone && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${step.name}`}
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-800"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl">
                <DropdownMenuItem
                  onClick={() => {
                    setInsertAfterId(step.id);
                    setIsAddStepOpen(true);
                  }}
                >
                  Add step after
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteStep(step.id)}
                  className="text-destructive focus:text-destructive"
                >
                  Delete step
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <div className="min-h-20 flex-1 overflow-y-auto pr-1">
          {columnCards.length === 0 && (
            <div className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-white/50 px-4 py-8 text-center text-xs font-medium text-slate-400">
              {isDone ? 'No completed cards' : 'No one at this step'}
            </div>
          )}
          {columnCards.map((card) => (
            <WorkflowCardComponent
              key={card.id}
              card={card}
              onClick={() => openCard(card)}
            />
          ))}
        </div>

        {!isDone && (
          <Button
            variant="ghost"
            className="mt-1 h-10 w-full justify-start rounded-xl text-slate-500 hover:bg-white hover:text-emerald-700"
            onClick={() => {
              setTargetStepId(step.id);
              setIsAddCardOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add person
          </Button>
        )}
      </section>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-128px)] flex-col bg-[#f5f7f3]">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Layers3 className="h-4 w-4 text-emerald-700" />
            {steps.length} steps
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CircleDot className="h-4 w-4 text-amber-500" />
            {activeCount} active
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {completedCount} done
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setInsertAfterId(steps.at(-1)?.id || null);
            setIsAddStepOpen(true);
          }}
          className="h-9 rounded-xl border-slate-200 bg-white font-semibold"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add step
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[520px] gap-4 pb-4">
          {steps.map((step) => renderColumn(step))}
          {renderColumn({ id: 'done', name: 'Completed' }, true)}
        </div>
      </div>

      {activeCard && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close card details"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setActiveCard(null)}
          />
          <aside className="relative flex h-full w-full flex-col bg-white shadow-2xl animate-in slide-in-from-right-8 duration-300 sm:max-w-[460px]">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                  Workflow card
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Card details
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveCard(null)}
                className="rounded-xl"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-200 text-sm font-bold text-emerald-800">
                  {activeCard.people.photo_url ? (
                    <img
                      src={activeCard.people.photo_url}
                      alt={`${activeCard.people.first_name} ${activeCard.people.last_name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      {activeCard.people.first_name[0]}
                      {activeCard.people.last_name[0]}
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-950">
                    {activeCard.people.first_name}{' '}
                    {activeCard.people.last_name}
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                    onClick={() =>
                      router.push(`/people/${activeCard.people.id}`)
                    }
                  >
                    View person profile
                  </button>
                </div>
              </div>

              {!activeCard.completed_at && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Current step
                  </label>
                  <Select
                    value={cardDraft.current_step_id}
                    onValueChange={(value) =>
                      setCardDraft({
                        ...cardDraft,
                        current_step_id: value || '',
                      })
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {steps.map((step) => (
                        <SelectItem key={step.id} value={step.id}>
                          {step.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Assigned to
                </label>
                <Select
                  value={cardDraft.assigned_to}
                  onValueChange={(value) =>
                    setCardDraft({
                      ...cardDraft,
                      assigned_to: value || 'unassigned',
                    })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl bg-white">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        Admin {user.user_id.slice(0, 6)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Due date
                </label>
                <Input
                  type="date"
                  value={cardDraft.due_date}
                  onChange={(event) =>
                    setCardDraft({
                      ...cardDraft,
                      due_date: event.target.value,
                    })
                  }
                  className="h-11 rounded-xl"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Follow-up notes
                </label>
                <Textarea
                  value={cardDraft.notes}
                  onChange={(event) =>
                    setCardDraft({ ...cardDraft, notes: event.target.value })
                  }
                  placeholder="Add context, outcomes, or the next action..."
                  className="min-h-32 rounded-xl"
                />
              </div>
            </div>

            <footer className="space-y-3 border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
              <Button
                onClick={handleUpdateCard}
                disabled={isSavingCard}
                className="h-11 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
              >
                {isSavingCard ? 'Saving...' : 'Save changes'}
              </Button>
              {!activeCard.completed_at ? (
                <Button
                  onClick={handleCompleteCard}
                  variant="outline"
                  className="h-11 w-full rounded-xl border-emerald-200 bg-white font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as complete
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-100 py-3 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed
                </div>
              )}
              <Button
                onClick={handleRemoveCard}
                variant="ghost"
                className="w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove from workflow
              </Button>
            </footer>
          </aside>
        </div>
      )}

      <Dialog open={isAddStepOpen} onOpenChange={setIsAddStepOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add workflow step</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Step name
            </label>
            <Input
              value={newStepName}
              onChange={(event) => setNewStepName(event.target.value)}
              placeholder="e.g. Welcome message sent"
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddStepOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddStep}
              disabled={!newStepName.trim()}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Add step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Add person to workflow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedPersonId(null);
                  performSearch(event.target.value);
                }}
                className="h-11 rounded-xl pl-10"
              />
            </div>

            {searchResults.length > 0 && !selectedPersonId && (
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200">
                {searchResults.map((person) => (
                  <button
                    type="button"
                    key={person.id}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-emerald-50"
                    onClick={() => {
                      setSelectedPersonId(person.id);
                      setSearchQuery(
                        `${person.first_name} ${person.last_name}`
                      );
                      setSearchResults([]);
                    }}
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                      {person.first_name[0]}
                      {person.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">
                        {person.first_name} {person.last_name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {person.email || 'No email address'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedPersonId && (
              <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <UserRound className="h-4 w-4" />
                    {searchQuery}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPersonId(null);
                      setSearchQuery('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Change
                  </button>
                </div>
                <Select
                  value={cardFormData.assigned_to}
                  onValueChange={(value) =>
                    setCardFormData({
                      ...cardFormData,
                      assigned_to: value || 'unassigned',
                    })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl bg-white">
                    <SelectValue placeholder="Assign owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        Admin {user.user_id.slice(0, 6)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={cardFormData.due_date}
                  onChange={(event) =>
                    setCardFormData({
                      ...cardFormData,
                      due_date: event.target.value,
                    })
                  }
                  className="h-11 rounded-xl bg-white"
                />
                <Textarea
                  placeholder="Initial notes or next action"
                  value={cardFormData.notes}
                  onChange={(event) =>
                    setCardFormData({
                      ...cardFormData,
                      notes: event.target.value,
                    })
                  }
                  className="min-h-24 rounded-xl bg-white"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddCardOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCard}
              disabled={!selectedPersonId}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Add to workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
