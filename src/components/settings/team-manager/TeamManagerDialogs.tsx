import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  InvitationResultDialog,
  type InvitationResult,
} from '@/components/settings/InvitationResultDialog';
import type { TenantRole } from '@/lib/tenant-context';

export function TeamManagerDialogs({
  isInviteOpen,
  setIsInviteOpen,
  resendPromptId,
  setResendPromptId,
  isSaving,
  email,
  setEmail,
  role,
  setRole,
  expiresInDays,
  setExpiresInDays,
  createdInvitation,
  setCreatedInvitation,
  currentRole,
  handleInvite,
  resendInvitation,
}: {
  isInviteOpen: boolean;
  setIsInviteOpen: (v: boolean) => void;
  resendPromptId: string | null;
  setResendPromptId: (v: string | null) => void;
  isSaving: boolean;
  email: string;
  setEmail: (v: string) => void;
  role: 'admin' | 'workflow_manager' | 'member';
  setRole: (v: 'admin' | 'workflow_manager' | 'member') => void;
  expiresInDays: string;
  setExpiresInDays: (v: string) => void;
  createdInvitation: InvitationResult | null;
  setCreatedInvitation: (v: InvitationResult | null) => void;
  currentRole: TenantRole;
  handleInvite: () => void;
  resendInvitation: (id: string) => void;
}) {
  return (
    <>
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              void handleInvite();
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Invite a teammate
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div>
                <label htmlFor="invite-email" className="mb-2 block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  className="h-11 rounded-xl"
                  autoFocus
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="invite-role" className="mb-2 block text-sm font-semibold text-slate-700">
                    Role
                  </label>
                  <Select
                    value={role}
                    onValueChange={(value) =>
                      setRole(value as 'admin' | 'workflow_manager' | 'member')
                    }
                  >
                    <SelectTrigger id="invite-role" className="h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      {currentRole === 'owner' && (
                        <>
                          <SelectItem value="workflow_manager">Workflow Manager</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="invite-expiry" className="mb-2 block text-sm font-semibold text-slate-700">
                    Link expires
                  </label>
                  <Select
                    value={expiresInDays}
                    onValueChange={(value) => setExpiresInDays(value || '7')}
                  >
                    <SelectTrigger id="invite-expiry" className="h-11 rounded-xl">
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
                type="button"
                variant="ghost"
                onClick={() => setIsInviteOpen(false)}
                disabled={isSaving}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
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
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resendPromptId} onOpenChange={(open) => !open && setResendPromptId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Already Invited</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-500">
            This person has already been invited. Do you want to resend the invitation? This will rotate the link and send a new email.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResendPromptId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resendPromptId) {
                  resendInvitation(resendPromptId);
                  setResendPromptId(null);
                  setEmail('');
                }
              }}
              className="bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Resend Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvitationResultDialog
        invitation={createdInvitation}
        onClose={() => setCreatedInvitation(null)}
      />
    </>
  );
}
