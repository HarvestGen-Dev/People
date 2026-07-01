'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Layers3,
  Loader2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WorkflowSummary } from '@/lib/types';

export function WorkflowIndexManager({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowSummary[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const totalActive = initialWorkflows.reduce(
    (sum, workflow) => sum + workflow.active_cards,
    0
  );
  const totalCompleted = initialWorkflows.reduce(
    (sum, workflow) => sum + workflow.completed_cards,
    0
  );

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to create workflow');
      const { data } = await response.json();
      toast.success('Workflow created');
      router.push(`/workflows/${data.id}`);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create workflow'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Follow-up
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Workflows
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Give every person a clear next step, an owner, and a visible path
            forward.
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
        >
          <Plus className="mr-2 h-4 w-4" />
          New workflow
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Workflows', initialWorkflows.length, GitBranch, 'bg-emerald-100 text-emerald-700'],
          ['Active cards', totalActive, CircleDot, 'bg-amber-100 text-amber-700'],
          ['Completed', totalCompleted, CheckCircle2, 'bg-sky-100 text-sky-700'],
        ].map(([label, value, StatIcon, color]) => {
          const Icon = StatIcon as typeof GitBranch;
          return (
            <div
              key={String(label)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${String(color)}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-950">
                  {String(value)}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  {String(label)}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {initialWorkflows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-20 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <GitBranch className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-950">
            Create your first workflow
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Start with a simple visitor journey, pastoral follow-up, or ministry
            onboarding pipeline.
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="mt-6 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
          >
            Create workflow
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialWorkflows.map((workflow) => {
            const total = workflow.active_cards + workflow.completed_cards;
            const completion = total
              ? Math.round((workflow.completed_cards / total) * 100)
              : 0;

            return (
              <article
                key={workflow.id}
                className="group flex flex-col rounded-3xl border border-slate-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_20px_45px_-35px_rgba(6,78,59,0.45)]"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-slate-950">
                      {workflow.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                      {workflow.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[
                    ['Steps', workflow.steps_count],
                    ['Active', workflow.active_cards],
                    ['Done', workflow.completed_cards],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                      <div className="text-lg font-bold text-slate-900">
                        {String(value)}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {String(label)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>Completion</span>
                    <span>{completion}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => router.push(`/workflows/${workflow.id}`)}
                  className="mt-6 h-10 w-full justify-between rounded-xl border-slate-200 font-bold group-hover:border-emerald-200 group-hover:bg-emerald-50"
                >
                  Open board
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-700" />
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Create a workflow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Workflow name
              </label>
              <Input
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                placeholder="e.g. New Visitor Journey"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData({ ...formData, description: event.target.value })
                }
                placeholder="What outcome should this workflow help your team achieve?"
                className="min-h-28 rounded-xl"
              />
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">
              After creating the workflow, add steps that reflect the real
              journey your team follows.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name.trim() || isSaving}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
