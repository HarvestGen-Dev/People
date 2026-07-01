// <!-- AGENT: FRONTEND -->
import { format } from 'date-fns';
import { Calendar, MessageSquareText, UserRound } from 'lucide-react';
import type { WorkflowBoardCard } from '@/lib/types';

export function WorkflowCardComponent({
  card,
  onClick,
}: {
  card: WorkflowBoardCard;
  onClick: () => void;
}) {
  const person = card.people;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-3 w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_-22px_rgba(15,23,42,0.55)] transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-[10px] font-bold text-emerald-700">
          {person.first_name[0]}
          {person.last_name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-emerald-700">
            {person.first_name} {person.last_name}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold capitalize text-slate-400">
            {person.status} · Added {format(new Date(card.created_at), 'd MMM')}
          </div>
        </div>
      </div>

      {(card.assigned_to || card.due_date) && (
        <div className="mt-4 grid gap-2">
          {card.assigned_to && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <UserRound className="h-3.5 w-3.5 text-slate-400" />
              Assigned
            </div>
          )}
          {card.due_date && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              Due {format(new Date(card.due_date), 'd MMM')}
            </div>
          )}
        </div>
      )}

      {card.notes && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{card.notes}</span>
        </div>
      )}
    </button>
  );
}
