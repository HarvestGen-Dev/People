import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function RegistrationDialogs({
  rejectDialogId,
  setRejectDialogId,
  rejectReason,
  setRejectReason,
  handleReject,
  loadingIds,
  lightboxUrl,
  setLightboxUrl,
}: {
  rejectDialogId: string | null;
  setRejectDialogId: (id: string | null) => void;
  rejectReason: string;
  setRejectReason: (reason: string) => void;
  handleReject: () => void;
  loadingIds: Set<string>;
  lightboxUrl: string | null;
  setLightboxUrl: (url: string | null) => void;
}) {
  return (
    <>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-screen max-w-4xl">
            <button
              type="button"
              aria-label="Close payment proof"
              className="absolute -top-12 right-0 text-white/70 hover:text-white"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={lightboxUrl}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              alt="Full payment proof"
            />
          </div>
        </div>
      )}

      <Dialog
        open={!!rejectDialogId}
        onOpenChange={(open) => !open && setRejectDialogId(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
            <DialogDescription>
              The registration will be marked as rejected. Add a reason for the
              internal record if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Reason
            </label>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Payment amount could not be verified"
              className="min-h-28 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectDialogId(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loadingIds.has(rejectDialogId || '')}
              className="rounded-xl"
            >
              {loadingIds.has(rejectDialogId || '') && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
