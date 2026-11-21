'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './ConfirmDialog';

export type HistoryItem = { id: string; version: number | null; status: 'published' | 'archived'; publishedAt: string | null };

interface RevisionHistoryProps {
  history: HistoryItem[];
  busy: boolean;
  onRestore: (id: string) => Promise<void>;
}

export function RevisionHistory({ history, busy, onRestore }: RevisionHistoryProps) {
  const [target, setTarget] = useState<HistoryItem | null>(null);
  return (
    <section aria-labelledby="history-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id="history-heading" className="text-base font-semibold">Published versions</h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been published yet. Visitors see the standard HG Link page.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                Version {item.version}{item.status === 'published' && <strong className="ml-2 text-primary">Live</strong>}
                {item.publishedAt && <span className="block text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString('en-MY')}</span>}
              </span>
              {item.status === 'archived' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setTarget(item)}>Restore</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={target !== null}
        title={`Restore version ${target?.version ?? ''}?`}
        description="This publishes that earlier version straight away, replacing what visitors see now. Your current live version stays in the history."
        confirmLabel="Restore and publish"
        busy={busy}
        onCancel={() => setTarget(null)}
        onConfirm={async () => {
          if (target) await onRestore(target.id);
          setTarget(null);
        }}
      />
    </section>
  );
}
