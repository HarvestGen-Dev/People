import { CheckCircle2, CircleDot, GitBranch } from 'lucide-react';

export function WorkflowStats({
  totalWorkflows,
  totalActive,
  totalCompleted,
}: {
  totalWorkflows: number;
  totalActive: number;
  totalCompleted: number;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {[
        ['Workflows', totalWorkflows, GitBranch, 'bg-emerald-100 text-emerald-700'],
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
  );
}
