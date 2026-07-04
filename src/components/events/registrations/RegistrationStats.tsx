import { Clock3, UserCheck, Users } from 'lucide-react';

export function RegistrationStats({
  counts,
}: {
  counts: {
    all: number;
    pending_review: number;
    approved: number;
    rejected: number;
  };
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {[
        ['Total', counts.all, Users, 'bg-slate-100 text-slate-700'],
        [
          'Awaiting review',
          counts.pending_review,
          Clock3,
          'bg-amber-100 text-amber-700',
        ],
        [
          'Approved',
          counts.approved,
          UserCheck,
          'bg-emerald-100 text-emerald-700',
        ],
      ].map(([label, value, StatIcon, color]) => {
        const Icon = StatIcon as typeof Users;
        return (
          <div
            key={String(label)}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${String(color)}`}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-950">
                {String(value)}
              </div>
              <div className="text-xs text-slate-500">{String(label)}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
