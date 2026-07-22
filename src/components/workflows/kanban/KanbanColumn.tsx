import { MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkflowCardComponent } from '../WorkflowCard';
import type { WorkflowBoardCard, WorkflowStep } from '@/lib/types';

export function KanbanColumn({
  step,
  isDone = false,
  cards,
  canManageStructure,
  canManageCards,
  setInsertAfterId,
  setIsAddStepOpen,
  handleDeleteStep,
  setTargetStepId,
  setIsAddCardOpen,
  openCard,
}: {
  step: Pick<WorkflowStep, 'id' | 'name'>;
  isDone?: boolean;
  cards: WorkflowBoardCard[];
  canManageStructure: boolean;
  canManageCards: boolean;
  setInsertAfterId: (id: string | null) => void;
  setIsAddStepOpen: (open: boolean) => void;
  handleDeleteStep: (id: string) => void;
  setTargetStepId: (id: string | null) => void;
  setIsAddCardOpen: (open: boolean) => void;
  openCard: (card: WorkflowBoardCard) => void;
}) {
  const columnCards = isDone
    ? cards.filter((card) => card.completed_at)
    : cards.filter(
        (card) => card.current_step_id === step.id && !card.completed_at
      );

  return (
    <section
      key={step.id || 'done'}
      aria-label={`${step.name} workflow step`}
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
        {!isDone && canManageStructure && (
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

      {!isDone && canManageCards && (
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
}
