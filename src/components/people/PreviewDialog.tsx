'use client';

// <!-- AGENT: FRONTEND -->
import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, X } from 'lucide-react';
import { toast } from 'sonner';

export function PreviewDialog({ children, closeHref, triggerId }: {
  children: ReactNode; closeHref: string; triggerId: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const element = dialog.current;
    if (!element?.open) element?.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, []);

  function dismiss() {
    dialog.current?.close();
    document.getElementById(triggerId)?.focus({ preventScroll: true });
    router.replace(closeHref, { scroll: false });
  }

  return (
    <dialog ref={dialog} className="workspace-dialog" aria-labelledby="person-preview-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="directory-preview">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="text-sm font-semibold text-muted-foreground">Profile preview</span>
          <button type="button" className="workspace-button workspace-icon-button size-11 p-0" aria-label="Close profile preview" onClick={dismiss}>
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function CopyEmailButton({ email }: { email: string }) {
  return <button type="button" className="workspace-button" onClick={async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copied');
    } catch {
      toast.error('Could not copy the email. You can select it from the profile details.');
    }
  }}><Copy size={16} aria-hidden="true" /> Copy email</button>;
}
