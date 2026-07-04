import { useState } from 'react';
import { toast } from 'sonner';
import type { ClaimRequestSummary, InvitationSummary } from '@/lib/team';
import type { InvitationResult } from '@/components/settings/InvitationResultDialog';

export function useTeamManager(
  initialInvitations: InvitationSummary[],
  initialClaimRequests: ClaimRequestSummary[],
  now: string
) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [claimRequests, setClaimRequests] = useState(initialClaimRequests);
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [resendPromptId, setResendPromptId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [busyClaimId, setBusyClaimId] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'workflow_manager' | 'member'>('member');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [createdInvitation, setCreatedInvitation] = useState<InvitationResult | null>(null);

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
        if (response.status === 409 && body.code === 'ALREADY_INVITED' && body.existingId) {
          setIsInviteOpen(false);
          setResendPromptId(body.existingId);
          return;
        }
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
    setBusyInvitationId(id);
    try {
      const response = await fetch(`/api/admin/invitations/${id}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to revoke invitation');
      }
      setInvitations((current) =>
        current.map((invitation) =>
          invitation.id === id
            ? { ...invitation, revokedAt: new Date().toISOString() }
            : invitation
        )
      );
      toast.success('Invitation revoked');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to revoke invitation'
      );
    } finally {
      setBusyInvitationId(null);
    }
  };

  const resendInvitation = async (id: string) => {
    setBusyInvitationId(id);
    try {
      const response = await fetch(`/api/admin/invitations/${id}/resend`, {
        method: 'POST',
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to resend invitation');
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
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to resend invitation'
      );
    } finally {
      setBusyInvitationId(null);
    }
  };

  const reviewClaim = async (
    requestId: string,
    decision: 'approve' | 'reject'
  ) => {
    setBusyClaimId(requestId);
    try {
      const response = await fetch('/api/admin/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, decision }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to review claim');
      }
      setClaimRequests((current) =>
        current.filter((request) => request.id !== requestId)
      );
      toast.success(decision === 'approve' ? 'Profile access approved' : 'Claim rejected');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to review claim'
      );
    } finally {
      setBusyClaimId(null);
    }
  };

  return {
    invitations,
    claimRequests,
    isInviteOpen,
    setIsInviteOpen,
    resendPromptId,
    setResendPromptId,
    isSaving,
    busyInvitationId,
    busyClaimId,
    email,
    setEmail,
    role,
    setRole,
    expiresInDays,
    setExpiresInDays,
    createdInvitation,
    setCreatedInvitation,
    pendingInvitations,
    historyInvitations,
    handleInvite,
    revokeInvitation,
    resendInvitation,
    reviewClaim,
  };
}
