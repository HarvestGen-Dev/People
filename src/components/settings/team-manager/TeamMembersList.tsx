import { Crown } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { TeamMemberSummary } from '@/lib/team';
import type { TenantRole } from '@/lib/tenant-context';

const roleStyles: Record<TenantRole, string> = {
  owner: 'border-amber-200 bg-amber-100 text-amber-800',
  admin: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  workflow_manager: 'border-purple-200 bg-purple-100 text-purple-700',
  member: 'border-slate-200 bg-slate-100 text-slate-600',
};

export function TeamMembersList({ members }: { members: TeamMemberSummary[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <h2 className="font-bold text-slate-950">Current team</h2>
        <p className="mt-1 text-xs text-slate-500">
          Owners and administrators can manage church data. Members have
          read-only access.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold uppercase text-emerald-700">
                {member.email.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">
                  {member.email}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Joined {format(new Date(member.joinedAt), 'd MMM yyyy')}
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`w-fit capitalize shadow-none ${roleStyles[member.role]}`}
            >
              {member.role === 'owner' && <Crown className="mr-1 h-3 w-3" />}
              {member.role}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
