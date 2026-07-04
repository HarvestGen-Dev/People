import { useRouter } from 'next/navigation';
import { ArrowRight, Layers3 } from 'lucide-react';
import type { WorkflowSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';

export function WorkflowGrid({ workflows }: { workflows: WorkflowSummary[] }) {
  const router = useRouter();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {workflows.map((workflow) => {
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
  );
}
