import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { EventRegistration } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { RegistrationFilter } from '@/hooks/useRegistrationsTable';

export function RegistrationList({
  filteredRegistrations,
  filter,
  isFreeEvent,
  selectedIds,
  loadingIds,
  toggleSelect,
  toggleSelectAll,
  handleApprove,
  setRejectDialogId,
  setLightboxUrl,
}: {
  filteredRegistrations: EventRegistration[];
  filter: RegistrationFilter;
  isFreeEvent: boolean;
  selectedIds: Set<string>;
  loadingIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  handleApprove: (id: string) => void;
  setRejectDialogId: (id: string) => void;
  setLightboxUrl: (url: string) => void;
}) {
  const renderActions = (registration: EventRegistration) => {
    if (registration.status !== 'pending_review') {
      return (
        <Badge
          variant="outline"
          className={
            registration.status === 'approved'
              ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
              : 'border-red-200 bg-red-100 text-red-700'
          }
        >
          {registration.status === 'approved' ? 'Approved' : 'Rejected'}
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg border-emerald-200 font-bold text-emerald-700 hover:bg-emerald-50"
          onClick={() => handleApprove(registration.id)}
          disabled={loadingIds.has(registration.id)}
        >
          {loadingIds.has(registration.id) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Approve'
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 rounded-lg text-destructive hover:bg-destructive/10"
          onClick={() => setRejectDialogId(registration.id)}
          disabled={loadingIds.has(registration.id)}
        >
          Reject
        </Button>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Grid View */}
      <div className="grid gap-3 md:hidden">
        {filteredRegistrations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-5 py-14 text-center text-sm font-medium text-slate-500">
            No registrations found for this status.
          </div>
        ) : (
          filteredRegistrations.map((registration) => (
            <article
              key={registration.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                {filter === 'pending_review' && (
                  <Checkbox
                    checked={selectedIds.has(registration.id)}
                    onCheckedChange={() => toggleSelect(registration.id)}
                    aria-label={`Select ${registration.first_name} ${registration.last_name}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900">
                    {registration.first_name} {registration.last_name}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {registration.email}
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  RM {registration.amount_due}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 text-slate-500">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Guests
                  </span>
                  <span className="mt-1 block font-bold text-slate-700">
                    {registration.guests}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-slate-500">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Submitted
                  </span>
                  <span className="mt-1 block font-bold text-slate-700">
                    {formatDistanceToNow(new Date(registration.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                {registration.payment_proof_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxUrl(registration.payment_proof_url as string)
                    }
                    className="text-xs font-bold text-emerald-700"
                  >
                    View payment proof
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    {isFreeEvent ? 'Free event' : 'No proof'}
                  </span>
                )}
                {renderActions(registration)}
              </div>
            </article>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {filter === 'pending_review' && (
                  <th className="w-12 px-4 py-4">
                    <Checkbox
                      checked={
                        selectedIds.size === filteredRegistrations.length &&
                        filteredRegistrations.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all registrations"
                    />
                  </th>
                )}
                <th className="px-4 py-4">Registrant</th>
                <th className="px-4 py-4">Guests</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">Submitted</th>
                <th className="px-4 py-4">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-slate-500"
                  >
                    No registrations found for this status.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((registration) => (
                  <tr
                    key={registration.id}
                    className="transition-colors hover:bg-emerald-50/30"
                  >
                    {filter === 'pending_review' && (
                      <td className="px-4 py-4">
                        <Checkbox
                          checked={selectedIds.has(registration.id)}
                          onCheckedChange={() =>
                            toggleSelect(registration.id)
                          }
                          aria-label={`Select ${registration.first_name} ${registration.last_name}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900">
                        {registration.first_name} {registration.last_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {registration.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-600">
                      {registration.guests}
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900">
                      RM {registration.amount_due}
                    </td>
                    <td className="px-4 py-4">
                      {registration.payment_proof_url ? (
                        <button
                          type="button"
                          className="h-10 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:opacity-80"
                          onClick={() =>
                            setLightboxUrl(registration.payment_proof_url as string)
                          }
                        >
                          <img
                            src={registration.payment_proof_url}
                            className="h-full w-full object-cover"
                            alt="Payment proof"
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {isFreeEvent ? 'Free event' : 'None'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatDistanceToNow(
                        new Date(registration.created_at),
                        { addSuffix: true }
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {renderActions(registration)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
