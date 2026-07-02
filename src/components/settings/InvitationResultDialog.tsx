'use client';

// <!-- AGENT: FRONTEND -->
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Link2, Mail, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type InvitationResult = {
  email: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string | null;
};

export function InvitationResultDialog({
  invitation,
  onClose,
}: {
  invitation: InvitationResult | null;
  onClose: () => void;
}) {
  const [qrCode, setQrCode] = useState<{
    source: string;
    dataUrl: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (invitation?.inviteUrl) {
      QRCode.toDataURL(invitation.inviteUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#064e3b', light: '#ffffff' },
      }).then((url) => {
        if (active) {
          setQrCode({ source: invitation.inviteUrl, dataUrl: url });
        }
      });
    }
    return () => {
      active = false;
    };
  }, [invitation]);

  const copyInvitation = async () => {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.inviteUrl);
    toast.success('Invitation link copied');
  };

  return (
    <Dialog open={!!invitation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Invitation ready</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-3">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-center text-sm leading-6 text-slate-600">
            This single-use invitation is bound to{' '}
            <strong className="text-slate-900">{invitation?.email}</strong>.
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <Link2 className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
            <code className="min-w-0 flex-1 truncate text-xs text-slate-500">
              {invitation?.inviteUrl}
            </code>
            <Button
              onClick={copyInvitation}
              size="sm"
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <QrCode className="h-4 w-4" />
              Scan to accept
            </div>
            {qrCode && qrCode.source === invitation?.inviteUrl ? (
              // The QR code is generated locally from the one-time invitation URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode.dataUrl}
                alt="Invitation QR code"
                className="mx-auto h-56 w-56"
              />
            ) : (
              <div className="mx-auto h-56 w-56 animate-pulse rounded-2xl bg-slate-100" />
            )}
          </div>
          <div
            className={`flex items-start gap-2 rounded-2xl p-4 text-xs leading-5 ${
              invitation?.emailSent
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            {invitation?.emailSent
              ? 'The invitation email was sent.'
              : invitation?.emailError || 'Email delivery is not configured; share the link or QR code.'}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="rounded-xl">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
