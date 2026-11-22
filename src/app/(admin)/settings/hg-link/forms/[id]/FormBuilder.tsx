'use client';

// <!-- AGENT: FRONTEND -->
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { HgLinkFormPage } from '@/components/hg-link/HgLinkFormPage';
import { formDefinitionSchema, type FormDefinition, type ResolvedOptions } from '@/lib/hg-link/formSchema';
import { sendJson } from '../../api';
import { ConfirmDialog } from '../../ConfirmDialog';
import { FieldsPanel } from './FieldsPanel';

type Option = { id: string; name: string };
type Settings = { title: string; description: string; isActive: boolean; targetTagId: string; targetWorkflowId: string; notifyEmail: string };

interface FormBuilderProps {
  formId: string;
  initialSettings: Settings;
  initialDefinition: FormDefinition;
  hasDraft: boolean;
  tags: Option[];
  workflows: Option[];
  lists: Option[];
}

const selectClass = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm';

export function FormBuilder({ formId, initialSettings, initialDefinition, hasDraft, tags, workflows, lists }: FormBuilderProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [definition, setDefinition] = useState(initialDefinition);
  const [baseline, setBaseline] = useState(JSON.stringify({ settings: initialSettings, definition: initialDefinition }));
  const [draftSaved, setDraftSaved] = useState(hasDraft);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'publish' | 'discard' | null>(null);

  const dirty = JSON.stringify({ settings, definition }) !== baseline;
  const validation = useMemo(() => formDefinitionSchema.safeParse(definition), [definition]);
  const problem = validation.success ? null : `${validation.error.issues[0].path.join(' › ')}: ${validation.error.issues[0].message}`;
  const patch = (partial: Partial<Settings>) => setSettings((s) => ({ ...s, ...partial }));
  const patchDef = (partial: Partial<FormDefinition>) => setDefinition((d) => ({ ...d, ...partial }));

  const previewOptions: ResolvedOptions = Object.fromEntries(
    definition.fields.filter((f) => f.optionsSource === 'lists').map((f) => [f.id, lists.map((l) => ({ value: l.id, label: l.name }))])
  );

  const body = () => ({
    title: settings.title,
    description: settings.description,
    isActive: settings.isActive,
    targetTagId: settings.targetTagId || null,
    targetWorkflowId: settings.targetWorkflowId || null,
    notifyEmail: settings.notifyEmail.trim() || null,
    definition,
  });

  const save = async () => {
    await sendJson('PUT', `/api/admin/hg-link/forms/${formId}`, body());
    setBaseline(JSON.stringify({ settings, definition }));
    setDraftSaved(true);
  };
  const run = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    try { await task(); toast.success(success); } catch (error) { toast.error(error instanceof Error ? error.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 backdrop-blur">
        <p className="mr-auto text-sm" role="status">
          {dirty ? 'You have unsaved changes.' : draftSaved ? 'Draft saved. Not live yet.' : 'Showing the live form.'}
          {problem && <span className="block text-destructive">{problem}</span>}
        </p>
        <Button variant="outline" disabled={busy || (!draftSaved && !dirty)} onClick={() => setConfirm('discard')}>Discard changes</Button>
        <Button variant="outline" disabled={busy || !dirty || Boolean(problem)} onClick={() => run(save, 'Draft saved')}>Save draft</Button>
        <Button disabled={busy || Boolean(problem) || (!dirty && !draftSaved)} onClick={() => setConfirm('publish')}>Publish form</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section aria-labelledby="form-settings-heading" className="space-y-4 rounded-xl border bg-card p-4">
            <h2 id="form-settings-heading" className="text-base font-semibold">Form details</h2>
            <div className="space-y-1.5"><Label htmlFor="f-title">Title</Label><Input id="f-title" value={settings.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="f-desc">Description (optional)</Label><Textarea id="f-desc" rows={2} value={settings.description} maxLength={400} onChange={(e) => patch({ description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="f-success">Message after submitting</Label><Textarea id="f-success" rows={2} value={definition.successMessage} maxLength={400} onChange={(e) => patchDef({ successMessage: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="f-submit">Button label</Label><Input id="f-submit" value={definition.submitLabel} maxLength={40} onChange={(e) => patchDef({ submitLabel: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="f-privacy">Privacy note</Label><Textarea id="f-privacy" rows={2} value={definition.privacyNote} maxLength={400} onChange={(e) => patchDef({ privacyNote: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={settings.isActive} aria-label="Form is open for submissions" onCheckedChange={(isActive) => patch({ isActive })} /> Open for submissions</label>
          </section>
          <section aria-labelledby="routing-heading" className="space-y-4 rounded-xl border bg-card p-4">
            <h2 id="routing-heading" className="text-base font-semibold">After someone submits</h2>
            <div className="space-y-1.5">
              <Label htmlFor="f-tag">Add this tag</Label>
              <select id="f-tag" className={selectClass} value={settings.targetTagId} onChange={(e) => patch({ targetTagId: e.target.value })}>
                <option value="">No tag</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-workflow">Start this workflow</Label>
              <select id="f-workflow" className={selectClass} value={settings.targetWorkflowId} onChange={(e) => patch({ targetWorkflowId: e.target.value })}>
                <option value="">No workflow</option>{workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">A person never gets a second open card in the same workflow.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-notify">Email a team inbox (optional)</Label>
              <Input id="f-notify" type="email" value={settings.notifyEmail} onChange={(e) => patch({ notifyEmail: e.target.value })} />
              <p className="text-xs text-muted-foreground">The email only links to the sign-in-protected submission. It never contains answers.</p>
            </div>
          </section>
          <FieldsPanel definition={definition} onChange={setDefinition} />
        </div>

        <section aria-labelledby="form-preview-heading" className="min-w-0 space-y-3">
          <h2 id="form-preview-heading" className="text-base font-semibold">Preview (nothing is sent)</h2>
          <div className="max-h-[80vh] overflow-auto rounded-2xl border">
            <HgLinkFormPage title={settings.title} description={settings.description} definition={validation.success ? definition : initialDefinition} options={previewOptions} backHref="#" preview />
          </div>
        </section>
      </div>

      <ConfirmDialog open={confirm === 'publish'} title="Publish this form?" description="Visitors will see the new questions straight away. Answers already collected are kept." confirmLabel="Publish" busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await run(async () => { await save(); await sendJson('POST', `/api/admin/hg-link/forms/${formId}/publish`); setDraftSaved(false); setBaseline(JSON.stringify({ settings, definition })); router.refresh(); }, 'Form published');
          setConfirm(null);
        }} />
      <ConfirmDialog open={confirm === 'discard'} title="Discard your changes?" description="Unsaved edits and your saved draft are removed. The live form is not affected." confirmLabel="Discard changes" destructive busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await run(async () => { if (draftSaved) await sendJson('DELETE', `/api/admin/hg-link/forms/${formId}`); router.refresh(); window.location.reload(); }, 'Changes discarded');
          setConfirm(null);
        }} />
    </div>
  );
}
