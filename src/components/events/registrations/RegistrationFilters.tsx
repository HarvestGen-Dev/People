import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RegistrationFilter } from '@/hooks/useRegistrationsTable';

export function RegistrationFilters({
  filter,
  setFilter,
  selectedIds,
  setSelectedIds,
  statusCounts,
  handleBulkApprove,
}: {
  filter: RegistrationFilter;
  setFilter: (f: RegistrationFilter) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  statusCounts: {
    all: number;
    pending_review: number;
    approved: number;
    rejected: number;
  };
  handleBulkApprove: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {(
          [
            ['pending_review', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['all', 'All'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setFilter(value);
              setSelectedIds(new Set());
            }}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              filter === value
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] text-slate-400 ring-1 ring-slate-200">
              {statusCounts[value]}
            </span>
          </button>
        ))}
      </div>

      {filter === 'pending_review' && selectedIds.size > 0 && (
        <Button
          onClick={handleBulkApprove}
          className="rounded-xl bg-emerald-700 font-bold text-white hover:bg-emerald-800"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Approve selected ({selectedIds.size})
        </Button>
      )}
    </div>
  );
}
