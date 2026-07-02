'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock3,
  Loader2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { EventRegistration } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type RegistrationFilter =
  | 'all'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export function RegistrationsTable({
  registrations,
  isFreeEvent,
}: {
  registrations: EventRegistration[];
  isFreeEvent: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] =
    useState<RegistrationFilter>('pending_review');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const filteredRegistrations = registrations.filter(
    (registration) => filter === 'all' || registration.status === filter
  );
  const statusCounts = {
    all: registrations.length,
    pending_review: registrations.filter(
      (registration) => registration.status === 'pending_review'
    ).length,
    approved: registrations.filter(
      (registration) => registration.status === 'approved'
    ).length,
    rejected: registrations.filter(
      (registration) => registration.status === 'rejected'
    ).length,
  };

  const updateLoading = (ids: string[], loading: boolean) => {
    setLoadingIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (loading) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleApprove = async (id: string) => {
    updateLoading([id], true);
    try {
      const response = await fetch(
        `/api/admin/registrations/${id}/approve`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to approve');
      toast.success('Approved — confirmation email sent');
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to approve'
      );
    } finally {
      updateLoading([id], false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialogId) return;
    const id = rejectDialogId;
    updateLoading([id], true);
    try {
      const response = await fetch(
        `/api/admin/registrations/${id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );
      if (!response.ok) throw new Error('Failed to reject');
      toast.success('Registration rejected');
      setRejectDialogId(null);
      setRejectReason('');
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to reject'
      );
    } finally {
      updateLoading([id], false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    updateLoading(ids, true);
    try {
      const response = await fetch(
        '/api/admin/registrations/bulk-approve',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        }
      );
      if (!response.ok) throw new Error('Bulk approve failed');
      toast.success(`Approved ${ids.length} registrations`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Bulk approval failed'
      );
    } finally {
      updateLoading(ids, false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRegistrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(filteredRegistrations.map((registration) => registration.id))
      );
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    <div className="space-y-6">
      <header>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Attendees
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
          Registration review
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Verify submissions, approve payments, and keep the attendee list
          accurate.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Total', statusCounts.all, Users, 'bg-slate-100 text-slate-700'],
          [
            'Awaiting review',
            statusCounts.pending_review,
            Clock3,
            'bg-amber-100 text-amber-700',
          ],
          [
            'Approved',
            statusCounts.approved,
            UserCheck,
            'bg-emerald-100 text-emerald-700',
          ],
        ].map(([label, value, StatIcon, color]) => {
          const Icon = StatIcon as typeof Users;
          return (
            <div
              key={String(label)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${String(color)}`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-950">
                  {String(value)}
                </div>
                <div className="text-xs text-slate-500">{String(label)}</div>
              </div>
            </div>
          );
        })}
      </section>

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
                      setLightboxUrl(registration.payment_proof_url)
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
                            setLightboxUrl(registration.payment_proof_url)
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-screen max-w-4xl">
            <button
              type="button"
              aria-label="Close payment proof"
              className="absolute -top-12 right-0 text-white/70 hover:text-white"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={lightboxUrl}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              alt="Full payment proof"
            />
          </div>
        </div>
      )}

      <Dialog
        open={!!rejectDialogId}
        onOpenChange={(open) => !open && setRejectDialogId(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
            <DialogDescription>
              The registration will be marked as rejected. Add a reason for the
              internal record if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Reason
            </label>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Payment amount could not be verified"
              className="min-h-28 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectDialogId(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loadingIds.has(rejectDialogId || '')}
              className="rounded-xl"
            >
              {loadingIds.has(rejectDialogId || '') && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
