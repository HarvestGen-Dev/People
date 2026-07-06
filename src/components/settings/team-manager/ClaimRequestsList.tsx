import { Button } from '@/components/ui/button';
import type { ClaimRequestSummary } from '@/lib/team';

export function ClaimRequestsList({
  claimRequests,
  busyClaimId,
  reviewClaim,
}: {
  claimRequests: ClaimRequestSummary[];
  busyClaimId: string | null;
  reviewClaim: (id: string, decision: 'approve' | 'reject') => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2 className="font-bold text-slate-950">Profile claim requests</h2>
        <p className="mt-1 text-xs text-slate-500">
          Review verified accounts whose imported profiles were not eligible for automatic claiming.
        </p>
      </div>
      {claimRequests.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-400">
          No profile claims require review.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {claimRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
            >
              <div>
                <div className="font-bold text-slate-900">{request.personName}</div>
                <div className="mt-1 text-xs text-slate-500">{request.email}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reviewClaim(request.id, 'reject')}
                  disabled={busyClaimId === request.id}
                  className="rounded-xl"
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => reviewClaim(request.id, 'approve')}
                  disabled={busyClaimId === request.id}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
                >
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
