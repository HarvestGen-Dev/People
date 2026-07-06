import { Clock3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { InvitationSummary } from '@/lib/team';

export function PendingInvitations({
  pendingInvitations,
  currentIsPlatformAdmin,
  busyInvitationId,
  resendInvitation,
  revokeInvitation,
}: {
  pendingInvitations: InvitationSummary[];
  currentIsPlatformAdmin: boolean;
  busyInvitationId: string | null;
  resendInvitation: (id: string) => void;
  revokeInvitation: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2 className="font-bold text-slate-950">Pending invitations</h2>
        <p className="mt-1 text-xs text-slate-500">
          Raw invitation links are shown only when first created.
        </p>
      </div>
      {pendingInvitations.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-400">
          No invitations are waiting to be accepted.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
            >
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {invitation.email}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock3 className="h-3 w-3" />
                  Expires{' '}
                  {formatDistanceToNow(new Date(invitation.expiresAt), {
                    addSuffix: true,
                  })}
                </div>
              </div>
              <Badge
                variant="outline"
                className="w-fit border-sky-200 bg-sky-100 capitalize text-sky-700"
              >
                {invitation.role}
              </Badge>
              {(invitation.role !== 'owner' || currentIsPlatformAdmin) && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => resendInvitation(invitation.id)}
                    disabled={busyInvitationId === invitation.id}
                    className="w-fit rounded-xl"
                  >
                    Resend
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeInvitation(invitation.id)}
                    disabled={busyInvitationId === invitation.id}
                    className="w-fit rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Revoke
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
