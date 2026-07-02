'use client';

// <!-- AGENT: FRONTEND -->
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, QrCode, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ShareEventButton({
  eventName,
  publicUrl,
  compact = false,
}: {
  eventName: string;
  publicUrl: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!open) return;
    QRCode.toDataURL(publicUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#064e3b', light: '#ffffff' },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [open, publicUrl]);

  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Event registration link copied');
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        className={compact ? 'h-8 w-8 rounded-lg' : 'rounded-xl font-bold'}
        title="Share registration link and QR code"
      >
        {compact ? <QrCode className="h-4 w-4" /> : (
          <>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Share {eventName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <p className="text-sm leading-6 text-slate-600">
              Anyone who scans this QR code can open the public event registration page.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              {qrDataUrl ? (
                // Generated locally from the public event URL.
                <img
                  src={qrDataUrl}
                  alt={`${eventName} registration QR code`}
                  className="mx-auto h-64 w-64"
                />
              ) : (
                <div className="mx-auto h-64 w-64 animate-pulse rounded-2xl bg-slate-100" />
              )}
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
              <code className="min-w-0 flex-1 truncate px-2 text-xs text-slate-500">
                {publicUrl}
              </code>
              <Button size="sm" onClick={copy} className="rounded-xl bg-emerald-700">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} className="rounded-xl">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
