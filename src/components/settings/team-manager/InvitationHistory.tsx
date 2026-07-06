import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { InvitationSummary } from '@/lib/team';

export function InvitationHistory({
  historyInvitations,
}: {
  historyInvitations: InvitationSummary[];
}) {
  if (historyInvitations.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2 className="font-bold text-slate-950">Invitation history</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {historyInvitations.slice(0, 10).map((invitation) => {
          const accepted = !!invitation.acceptedAt;
          return (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
            >
              <div>
                <div className="text-sm font-semibold text-slate-700">
                  {invitation.email}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Invited {format(new Date(invitation.createdAt), 'd MMM yyyy')}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  accepted
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-100 text-slate-500'
                }
              >
                {accepted ? 'Accepted' : 'Expired'}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
