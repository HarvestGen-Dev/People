import { formatDistanceToNow, format } from 'date-fns';
import { User, Calendar, MessageSquare } from 'lucide-react';

export function WorkflowCardComponent({ card, onClick }: { card: any, onClick: () => void }) {
  const p = card.people;
  
  return (
    <div 
      onClick={onClick}
      className="bg-white border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer mb-3 group"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
          {p.photo_url ? (
            <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-medium text-slate-500">{p.first_name[0]}{p.last_name[0]}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 text-sm truncate">{p.first_name} {p.last_name}</div>
          <div className="text-xs text-slate-500 truncate capitalize flex items-center gap-1">
            {p.status} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mt-3">
        {card.assigned_to && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="h-3 w-3 text-slate-400" />
            <span className="truncate">Assigned</span>
          </div>
        )}
        
        {card.due_date && (
          <div className={`flex items-center gap-1.5 text-xs ${new Date(card.due_date) < new Date() ? 'text-destructive font-medium' : 'text-slate-600'}`}>
            <Calendar className={`h-3 w-3 ${new Date(card.due_date) < new Date() ? 'text-destructive' : 'text-slate-400'}`} />
            <span>Due {format(new Date(card.due_date), 'MMM d')}</span>
          </div>
        )}
      </div>

      {card.notes && (
        <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-border flex items-start gap-1.5 line-clamp-2 italic">
          "{card.notes}"
        </div>
      )}
    </div>
  );
}
