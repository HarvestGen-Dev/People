import { MailCheck } from 'lucide-react';

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[660px]">
      <div className="absolute -inset-10 rounded-full bg-emerald-300/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_30px_90px_-35px_rgba(6,78,59,0.45)] ring-1 ring-emerald-950/5">
        <div className="flex h-11 items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <div className="mx-auto rounded-md border border-slate-200 bg-white px-12 py-1 text-[9px] font-medium text-slate-400">
            people.harvestgen.org
          </div>
        </div>

        <div className="flex min-h-[390px]">
          <div className="hidden w-36 shrink-0 border-r border-emerald-900 bg-emerald-950 p-3 sm:block">
            <div className="mb-6 flex items-center gap-2 px-1 text-white">
              <div className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-400 text-[8px] font-bold text-emerald-950">
                HG
              </div>
              <span className="text-[10px] font-semibold">People</span>
            </div>
            {[
              ['Overview', true],
              ['People', false],
              ['Lists', false],
              ['Workflows', false],
              ['Events', false],
            ].map(([label, active]) => (
              <div
                key={String(label)}
                className={`mb-1 rounded-lg px-2 py-2 text-[9px] font-medium ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-emerald-100/55'
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 bg-[#f7f8f5] p-4 sm:p-5">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Thursday, 2 July
                </div>
                <div className="mt-1 text-lg font-bold tracking-tight text-slate-950">
                  Good morning, team
                </div>
              </div>
              <div className="rounded-lg bg-emerald-700 px-3 py-2 text-[9px] font-semibold text-white">
                + Add person
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                ['Active people', '1,248', '+24'],
                ['Visitors', '86', '+12'],
                ['In follow-up', '31', '8 due'],
                ['Events', '4', '2 live'],
              ].map(([label, value, note]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200/80 bg-white p-3"
                >
                  <div className="text-[8px] font-medium text-slate-400">
                    {label}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-1">
                    <span className="text-lg font-bold text-slate-900">
                      {value}
                    </span>
                    <span className="text-[7px] font-semibold text-emerald-600">
                      {note}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-800">
                    New visitors
                  </span>
                  <span className="text-[8px] font-semibold text-emerald-700">
                    View all
                  </span>
                </div>
                {[
                  ['AL', 'Alicia Lee', 'New here', 'Today'],
                  ['JN', 'Joshua Ng', 'Event', 'Yesterday'],
                  ['RM', 'Rachel Menon', 'Drip & Brew', '2 days'],
                ].map(([initials, name, source, time]) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 border-t border-slate-100 py-2"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-[8px] font-bold text-emerald-700">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[9px] font-semibold text-slate-800">
                        {name}
                      </div>
                      <div className="text-[7px] text-slate-400">{source}</div>
                    </div>
                    <div className="text-[7px] text-slate-400">{time}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                <div className="text-[10px] font-bold text-slate-800">
                  Follow-up health
                </div>
                <div className="mx-auto my-4 grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(#059669_0_78%,#e2e8f0_78%_100%)]">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center">
                    <div>
                      <div className="text-lg font-bold text-slate-900">78%</div>
                      <div className="text-[7px] text-slate-400">on track</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-2 text-[8px] font-medium text-amber-800">
                  8 follow-ups due today
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-3 hidden items-center gap-3 rounded-2xl border border-white bg-white/95 p-3 shadow-xl backdrop-blur sm:flex">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <MailCheck className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-900">Follow-up assigned</div>
          <div className="text-[10px] text-slate-500">Visitor Care · just now</div>
        </div>
      </div>
    </div>
  );
}
