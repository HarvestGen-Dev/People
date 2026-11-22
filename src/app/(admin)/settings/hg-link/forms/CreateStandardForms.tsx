'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sendJson } from '../api';

export function CreateStandardForms({ missing }: { missing: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <p className="text-sm">{missing} standard HG Links form{missing === 1 ? '' : 's'} not set up yet (new to church, became a Christian, water baptism, serve).</p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await sendJson('POST', '/api/admin/hg-link/forms');
            toast.success('Standard forms created');
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create forms');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Creating…' : 'Set up standard forms'}
      </Button>
    </div>
  );
}
