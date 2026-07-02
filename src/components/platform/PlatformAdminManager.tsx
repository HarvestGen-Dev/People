'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { Building2, Loader2, Plus, Settings2, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
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
  InvitationResultDialog,
  type InvitationResult,
} from '@/components/settings/InvitationResultDialog';

export type PlatformChurch = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerCount: number;
};

export function PlatformAdminManager({
  initialChurches,
}: {
  initialChurches: PlatformChurch[];
}) {
  const [churches, setChurches] = useState(initialChurches);
  const [createOpen, setCreateOpen] = useState(false);
  const [ownerChurch, setOwnerChurch] = useState<PlatformChurch | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [invitation, setInvitation] = useState<InvitationResult | null>(null);

  const createChurch = async () => {
    setSaving(true);
    const response = await fetch('/api/platform/churches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      toast.error(body.error || 'Unable to create church');
      return;
    }
    setChurches((current) => [
      ...current,
      {
        id: body.data.id,
        name: body.data.name,
        slug: body.data.slug,
        createdAt: body.data.created_at,
        ownerCount: 0,
      },
    ].sort((a, b) => a.name.localeCompare(b.name)));
    setCreateOpen(false);
    setName('');
    setSlug('');
    toast.success('Church created');
  };

  const inviteOwner = async () => {
    if (!ownerChurch) return;
    setSaving(true);
    const response = await fetch('/api/platform/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        church_id: ownerChurch.id,
        email: ownerEmail,
        expires_in_days: 7,
      }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      toast.error(body.error || 'Unable to invite owner');
      return;
    }
    setOwnerChurch(null);
    setOwnerEmail('');
    setInvitation({
      email: body.data.invitation.email,
      inviteUrl: body.data.invite_url,
      emailSent: body.data.email_sent,
      emailError: body.data.email_error,
    });
  };

  const manageChurch = async (churchId: string) => {
    const response = await fetch(`/api/platform/churches/${churchId}/select`, {
      method: 'POST',
    });
    if (!response.ok) {
      const body = await response.json();
      toast.error(body.error || 'Unable to select church');
      return;
    }
    window.location.assign('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f5f7f3]">
      <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8 lg:p-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
              Platform administration
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
              Churches
            </h1>
            <p className="mt-2 text-slate-500">
              Create tenants, assign owners, and enter a church administration workspace.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add church
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {churches.map((church) => (
            <article
              key={church.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold text-slate-950">{church.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">/{church.slug}</p>
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    {church.ownerCount} {church.ownerCount === 1 ? 'owner' : 'owners'}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setOwnerChurch(church)}
                  className="rounded-xl"
                >
                  <UserRoundPlus className="mr-2 h-4 w-4" />
                  Invite owner
                </Button>
                <Button
                  onClick={() => manageChurch(church.id)}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage
                </Button>
              </div>
            </article>
          ))}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Create church</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slug) {
                  setSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')
                  );
                }
              }}
              placeholder="Church name"
              className="h-11 rounded-xl"
            />
            <Input
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              placeholder="church-slug"
              className="h-11 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={createChurch}
              disabled={saving || !name || !slug}
              className="rounded-xl bg-emerald-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ownerChurch} onOpenChange={(open) => !open && setOwnerChurch(null)}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Invite owner to {ownerChurch?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="owner@example.com"
              className="h-11 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOwnerChurch(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={inviteOwner}
              disabled={saving || !ownerEmail}
              className="rounded-xl bg-emerald-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send owner invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvitationResultDialog
        invitation={invitation}
        onClose={() => setInvitation(null)}
      />
    </div>
  );
}
