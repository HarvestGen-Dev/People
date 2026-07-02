'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import {
  Clock3,
  Crown,
  Loader2,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TenantRole } from '@/lib/tenant-context';
import type {
  ClaimRequestSummary,
  InvitationSummary,
  TeamMemberSummary,
} from '@/lib/team';
import {
  InvitationResultDialog,
  type InvitationResult,
} from '@/components/settings/InvitationResultDialog';

const roleStyles: Record<TenantRole, string> = {
  owner: 'border-amber-200 bg-amber-100 text-amber-800',
  admin: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  member: 'border-slate-200 bg-slate-100 text-slate-600',
};

export function TeamManager({
  churchName,
  currentRole,
  currentIsPlatformAdmin,
  initialMembers,
  initialInvitations,
  initialClaimRequests,
  now,
}: {
  churchName: string;
  currentRole: TenantRole;
  currentIsPlatformAdmin: boolean;
  initialMembers: TeamMemberSummary[];
  initialInvitations: InvitationSummary[];
  initialClaimRequests: ClaimRequestSummary[];
  now: string;
}) {
  const [members] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [claimRequests, setClaimRequests] = useState(initialClaimRequests);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [createdInvitation, setCreatedInvitation] =
    useState<InvitationResult | null>(null);

  const pendingInvitations = invitations.filter(
    (invitation) =>
      !invitation.acceptedAt &&
      !invitation.revokedAt &&
      new Date(invitation.expiresAt).getTime() > new Date(now).getTime()
  );
  const historyInvitations = invitations.filter(
    (invitation) => !pendingInvitations.some((item) => item.id === invitation.id)
  );

  const handleInvite = async () => {
    if (!email.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          expires_in_days: Number(expiresInDays),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to create invitation');
      }

      const invitation: InvitationSummary = {
        id: body.data.invitation.id,
        email: body.data.invitation.email,
        role: body.data.invitation.role,
        expiresAt: body.data.invitation.expires_at,
        acceptedAt: null,
        revokedAt: null,
        sentAt: body.data.email_sent ? new Date().toISOString() : null,
        createdAt: body.data.invitation.created_at,
      };
      setInvitations((current) => [invitation, ...current]);
      setCreatedInvitation({
        email: invitation.email,
        inviteUrl: body.data.invite_url,
        emailSent: body.data.email_sent,
        emailError: body.data.email_error,
      });
      setIsInviteOpen(false);
      setEmail('');
      setRole('member');
      setExpiresInDays('7');
      toast.success('Invitation created');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create invitation'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const revokeInvitation = async (id: string) => {
    const response = await fetch(`/api/admin/invitations/${id}`, {
      method: 'DELETE',
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error || 'Unable to revoke invitation');
      return;
    }
    setInvitations((current) =>
      current.map((invitation) =>
        invitation.id === id
          ? { ...invitation, revokedAt: new Date().toISOString() }
          : invitation
      )
    );
    toast.success('Invitation revoked');
  };

  const resendInvitation = async (id: string) => {
    const response = await fetch(`/api/admin/invitations/${id}/resend`, {
      method: 'POST',
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error || 'Unable to resend invitation');
      return;
    }

    const replacement: InvitationSummary = {
      id: body.data.invitation.id,
      email: body.data.invitation.email,
      role: body.data.invitation.role,
      expiresAt: body.data.invitation.expires_at,
      acceptedAt: null,
      revokedAt: null,
      sentAt: body.data.email_sent ? new Date().toISOString() : null,
      createdAt: body.data.invitation.created_at,
    };
    setInvitations((current) => [
      replacement,
      ...current.map((invitation) =>
        invitation.id === id
          ? { ...invitation, revokedAt: new Date().toISOString() }
          : invitation
      ),
    ]);
    setCreatedInvitation({
      email: replacement.email,
      inviteUrl: body.data.invite_url,
      emailSent: body.data.email_sent,
      emailError: body.data.email_error,
    });
    toast.success('Invitation rotated');
  };

  const reviewClaim = async (
    requestId: string,
    decision: 'approve' | 'reject'
  ) => {
    const response = await fetch('/api/admin/claims', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, decision }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error || 'Unable to review claim');
      return;
    }
    setClaimRequests((current) =>
      current.filter((request) => request.id !== requestId)
    );
    toast.success(decision === 'approve' ? 'Profile access approved' : 'Claim rejected');
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Access management
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">
            Team & invitations
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Control who can access {churchName} and issue secure, expiring
            signup links.
          </p>
        </div>
        <Button
          onClick={() => setIsInviteOpen(true)}
          className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite teammate
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Team members', members.length, Users, 'bg-emerald-100 text-emerald-700'],
          [
            'Pending invites',
            pendingInvitations.length,
            Mail,
            'bg-sky-100 text-sky-700',
          ],
          [
            'Your role',
            currentRole,
            ShieldCheck,
            'bg-amber-100 text-amber-700',
          ],
        ].map(([label, value, StatIcon, color]) => {
          const Icon = StatIcon as typeof Users;
          return (
            <div
              key={String(label)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${String(color)}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold capitalize text-slate-950">
                  {String(value)}
                </div>
                <div className="text-xs text-slate-500">{String(label)}</div>
              </div>
            </div>
          );
        })}
      </section>

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
                    className="w-fit rounded-xl"
                  >
                    Resend
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeInvitation(invitation.id)}
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
                    className="rounded-xl"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => reviewClaim(request.id, 'approve')}
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

      {historyInvitations.length > 0 && (
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
      )}

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Invite a teammate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Role
                </label>
                <Select
                  value={role}
                  onValueChange={(value) =>
                    setRole(value === 'admin' ? 'admin' : 'member')
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    {currentRole === 'owner' && (
                      <SelectItem value="admin">Administrator</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Link expires
                </label>
                <Select
                  value={expiresInDays}
                  onValueChange={(value) => setExpiresInDays(value || '7')}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">In 1 day</SelectItem>
                    <SelectItem value="7">In 7 days</SelectItem>
                    <SelectItem value="14">In 14 days</SelectItem>
                    <SelectItem value="30">In 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">
              The link is single-use and bound to this exact email address.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsInviteOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!email.trim() || isSaving}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Create invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvitationResultDialog
        invitation={createdInvitation}
        onClose={() => setCreatedInvitation(null)}
      />
    </div>
  );
}
