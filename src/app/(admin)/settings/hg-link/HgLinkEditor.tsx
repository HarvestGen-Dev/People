'use client';

// <!-- AGENT: FRONTEND -->
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { contentSchema, type HgLinkContent } from '@/lib/hg-link/contentSchema';
import { sendJson } from './api';
import { CardsPanel } from './CardsPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { PageSettingsPanel } from './PageSettingsPanel';
import { PreviewPane } from './PreviewPane';
import { RevisionHistory, type HistoryItem } from './RevisionHistory';

interface HgLinkEditorProps {
  initialContent: HgLinkContent;
  publishedContent: HgLinkContent;
  hasServerDraft: boolean;
  history: HistoryItem[];
  forms: { slug: string; title: string }[];
  publicUrl: string | null;
}

type Pending = 'save' | 'publish' | 'discard' | 'restore' | null;

export function HgLinkEditor({ initialContent, publishedContent, hasServerDraft, history, forms, publicUrl }: HgLinkEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [baseline, setBaseline] = useState(JSON.stringify(initialContent));
  const [hasDraft, setHasDraft] = useState(hasServerDraft);
  const [pending, setPending] = useState<Pending>(null);
  const [refreshing, startRefresh] = useTransition();
  const [confirm, setConfirm] = useState<'publish' | 'discard' | null>(null);

  const dirty = JSON.stringify(content) !== baseline;
  const validation = useMemo(() => contentSchema.safeParse(content), [content]);
  const problem = validation.success ? null : `${validation.error.issues[0].path.join(' › ')}: ${validation.error.issues[0].message}`;
  const busy = pending !== null || refreshing;

  const run = async (kind: Exclude<Pending, null>, task: () => Promise<void>, success: string) => {
    setPending(kind);
    try {
      await task();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setPending(null);
    }
  };

  const saveDraft = async () => {
    await sendJson('PUT', '/api/admin/hg-link/page', { content });
    setBaseline(JSON.stringify(content));
    setHasDraft(true);
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 backdrop-blur">
        <p className="mr-auto text-sm" role="status">
          {dirty ? 'You have unsaved changes.' : hasDraft ? 'Draft saved. Not live yet.' : 'Showing the live page.'}
          {problem && <span className="block text-destructive">{problem}</span>}
        </p>
        <Button variant="outline" disabled={busy || !hasDraft && !dirty} onClick={() => setConfirm('discard')}>Discard changes</Button>
        <Button variant="outline" disabled={busy || !dirty || Boolean(problem)} onClick={() => run('save', saveDraft, 'Draft saved')}>Save draft</Button>
        <Button disabled={busy || Boolean(problem) || (!dirty && !hasDraft)} onClick={() => setConfirm('publish')}>Publish changes</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <PageSettingsPanel content={content} onChange={setContent} />
          <CardsPanel content={content} forms={forms} onChange={setContent} />
          <RevisionHistory
            history={history}
            busy={busy}
            onRestore={(id) => run('restore', async () => {
              await sendJson('POST', '/api/admin/hg-link/page/restore', { revisionId: id });
              startRefresh(() => router.refresh());
            }, 'Version restored and published')}
          />
          {publicUrl && <p className="text-sm text-muted-foreground">Public page: <a className="underline" href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl}</a></p>}
        </fieldset>
        <PreviewPane content={content} />
      </div>

      <ConfirmDialog
        open={confirm === 'publish'}
        title="Publish these changes?"
        description="Visitors will see the new page straight away. You can restore an earlier version from the history."
        confirmLabel="Publish"
        busy={pending === 'publish'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await run('publish', async () => {
            if (dirty || !hasDraft) await saveDraft();
            await sendJson('POST', '/api/admin/hg-link/page/publish');
            setHasDraft(false);
            startRefresh(() => router.refresh());
          }, 'Published');
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Discard your changes?"
        description="Unsaved edits and your saved draft are removed. The live page is not affected."
        confirmLabel="Discard changes"
        destructive
        busy={pending === 'discard'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await run('discard', async () => {
            if (hasDraft) await sendJson('DELETE', '/api/admin/hg-link/page');
            setContent(publishedContent);
            setBaseline(JSON.stringify(publishedContent));
            setHasDraft(false);
          }, 'Changes discarded');
          setConfirm(null);
        }}
      />
    </div>
  );
}
