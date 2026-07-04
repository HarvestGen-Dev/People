import {
  CalendarDays,
  CircleUserRound,
  GitBranch,
  LayoutList,
  Network,
  ScanSearch,
  Tags,
  Users,
  Webhook,
  Workflow,
  ChevronRight,
} from 'lucide-react';

const capabilities = [
  {
    icon: Users,
    title: 'People directory',
    description:
      'Keep members, visitors, households, contact details, roles, and pastoral context in one reliable profile.',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: LayoutList,
    title: 'Smart lists',
    description:
      'Build live audiences from status, campus, tags, custom fields, dates, and contact information.',
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    icon: GitBranch,
    title: 'Follow-up workflows',
    description:
      'Move people through clear next steps, assign owners, add notes, set due dates, and close the loop.',
    accent: 'bg-violet-100 text-violet-700',
  },
  {
    icon: CalendarDays,
    title: 'Events & registration',
    description:
      'Publish events, collect registrations and payment proof, review attendees, and send confirmations.',
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    icon: Tags,
    title: 'Flexible church data',
    description:
      'Shape the system around your ministry with tags, custom fields, campuses, roles, and household data.',
    accent: 'bg-rose-100 text-rose-700',
  },
  {
    icon: Network,
    title: 'Connected church systems',
    description:
      'Give Shepherd, Drip & Brew, and future tools a secure way to find people and record activity.',
    accent: 'bg-teal-100 text-teal-700',
  },
];

export function FeaturesSection() {
  return (
    <>
      <section className="border-y border-slate-200/80 bg-white/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-5 px-5 py-7 text-sm font-semibold text-slate-500 sm:px-8 lg:justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            One shared source of truth
          </span>
          {[
            [CircleUserRound, 'Profiles'],
            [ScanSearch, 'Smart audiences'],
            [Workflow, 'Follow-up'],
            [CalendarDays, 'Events'],
            [Webhook, 'Integrations'],
          ].map(([Icon, label]) => {
            const CapabilityIcon = Icon as typeof Users;
            return (
              <span key={String(label)} className="flex items-center gap-2">
                <CapabilityIcon className="h-4 w-4 text-emerald-700" />
                {String(label)}
              </span>
            );
          })}
        </div>
      </section>

      <section id="capabilities" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Complete church CRM
              </div>
              <h2 className="text-balance text-4xl font-bold tracking-[-0.035em] text-slate-950 sm:text-5xl">
                Every function starts with a person.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-600 lg:justify-self-end">
              People replaces disconnected spreadsheets and partial records
              with a living view of your community—then gives every team a
              practical way to act on what they know.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <article
                key={capability.title}
                className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_50px_-30px_rgba(6,78,59,0.35)]"
              >
                <div
                  className={`mb-6 grid h-12 w-12 place-items-center rounded-2xl ${capability.accent}`}
                >
                  <capability.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-slate-950">
                  {capability.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {capability.description}
                </p>
                <div className="mt-6 flex items-center gap-1 text-sm font-bold text-emerald-700 opacity-70 transition-opacity group-hover:opacity-100">
                  Built into People <ChevronRight className="h-4 w-4" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
