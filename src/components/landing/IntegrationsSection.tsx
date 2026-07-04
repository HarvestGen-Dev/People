import {
  BookOpen,
  Coffee,
  Database,
  KeyRound,
  ScanSearch,
  Users,
  Webhook,
  Zap,
} from 'lucide-react';

export function IntegrationsSection() {
  return (
    <section id="integrations" className="scroll-mt-20 bg-[#f0f4ef] py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            HarvestGen Church OS
          </div>
          <h2 className="text-balance text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            One identity across every touchpoint.
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            People acts as the shared identity backbone. Connected tools can
            find the right profile, add activity, and respond to updates
            without creating another silo.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [KeyRound, 'Scoped API keys'],
              [Webhook, 'Reliable webhooks'],
              [ScanSearch, 'Atomic identity lookup'],
              [Database, 'Normalized contact data'],
            ].map(([Icon, label]) => {
              const FeatureIcon = Icon as typeof Users;
              return (
                <div
                  key={String(label)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-bold text-slate-700"
                >
                  <FeatureIcon className="h-5 w-5 text-emerald-700" />
                  {String(label)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mx-auto grid w-full max-w-xl place-items-center py-12">
          <div className="absolute h-72 w-72 rounded-full border border-dashed border-emerald-500/30" />
          <div className="absolute h-52 w-52 rounded-full border border-emerald-500/20" />
          <div className="relative z-10 grid h-32 w-32 place-items-center rounded-[30px] bg-emerald-950 text-center text-white shadow-2xl">
            <div>
              <Users className="mx-auto h-7 w-7 text-emerald-300" />
              <div className="mt-2 text-sm font-bold">People</div>
              <div className="text-[9px] text-emerald-200/70">Identity hub</div>
            </div>
          </div>
          <div className="absolute left-0 top-7 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:left-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Shepherd</div>
              <div className="text-[10px] text-slate-500">Learning & growth</div>
            </div>
          </div>
          <div className="absolute bottom-3 right-0 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:right-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Drip & Brew</div>
              <div className="text-[10px] text-slate-500">Café touchpoints</div>
            </div>
          </div>
          <div className="absolute right-2 top-10 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:right-12">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Future tools</div>
              <div className="text-[10px] text-slate-500">Ready to connect</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
