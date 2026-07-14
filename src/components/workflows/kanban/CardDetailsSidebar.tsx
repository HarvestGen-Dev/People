import { useRouter } from 'next/navigation';
import { X, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowBoardCard, WorkflowStep, WorkflowAdminUser } from '@/lib/types';
import type { CardDraft } from '@/hooks/useKanbanBoard';
import { displayIdFor } from '@/lib/display-ids';

export function CardDetailsSidebar({
  activeCard,
  setActiveCard,
  canManage,
  cardDraft,
  setCardDraft,
  steps,
  users,
  isSavingCard,
  handleUpdateCard,
  handleCompleteCard,
  handleRemoveCard,
}: {
  activeCard: WorkflowBoardCard;
  setActiveCard: (card: WorkflowBoardCard | null) => void;
  canManage: boolean;
  cardDraft: CardDraft;
  setCardDraft: (draft: CardDraft) => void;
  steps: WorkflowStep[];
  users: WorkflowAdminUser[];
  isSavingCard: boolean;
  handleUpdateCard: () => void;
  handleCompleteCard: () => void;
  handleRemoveCard: () => void;
}) {
  const router = useRouter();
  const personDisplayId = activeCard ? displayIdFor(activeCard.people) : null;

  return (
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
                {activeCard.people.first_name} {activeCard.people.last_name}
              </div>
              <button
                type="button"
                className="mt-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                onClick={() => personDisplayId && router.push(`/people/${personDisplayId}`)}
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
                disabled={!canManage}
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
              disabled={!canManage}
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
              disabled={!canManage}
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
              disabled={!canManage}
              value={cardDraft.notes}
              onChange={(event) =>
                setCardDraft({ ...cardDraft, notes: event.target.value })
              }
              placeholder="Add context, outcomes, or the next action..."
              className="min-h-32 rounded-xl"
            />
          </div>
        </div>

        {canManage && (
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
        )}
      </aside>
    </div>
  );
}
