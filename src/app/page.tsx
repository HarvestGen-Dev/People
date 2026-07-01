// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  Coffee,
  Database,
  GitBranch,
  KeyRound,
  LayoutList,
  LockKeyhole,
  MailCheck,
  Network,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Tags,
  UserRoundPlus,
  Users,
  Webhook,
  Workflow,
  Zap,
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

const operatingSteps = [
  {
    number: '01',
    title: 'Capture every person',
    description:
      'Add someone manually, import a CSV, accept an event registration, or receive them through an integration.',
  },
  {
    number: '02',
    title: 'Build a complete picture',
    description:
      'Combine profile details, tags, ministry roles, household relationships, notes, and activity history.',
  },
  {
    number: '03',
    title: 'Turn insight into action',
    description:
      'Create smart lists and move people into workflows with clear ownership and a visible next step.',
  },
  {
    number: '04',
    title: 'Keep every system in sync',
    description:
      'Use tenant-scoped API keys and webhooks to connect the wider HarvestGen Church OS safely.',
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-emerald-950 text-white shadow-sm">
        <span className="absolute h-7 w-3 rotate-45 rounded-full bg-emerald-400/70" />
        <span className="relative text-xs font-bold tracking-tight">HG</span>
      </div>
      <div className="leading-none">
        <div className="text-[11px] font-semibold uppercase tracking-[0.19em] text-emerald-700">
          HarvestGen
        </div>
        <div className="mt-1 text-base font-bold tracking-tight text-slate-950">
          People
        </div>
      </div>
    </div>
  );
}

function ProductPreview() {
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

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfcf9] text-slate-950 selection:bg-emerald-200">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-emerald-950/8 bg-[#fbfcf9]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="HarvestGen People home">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            <Link
              href="#capabilities"
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-emerald-800"
            >
              Capabilities
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-emerald-800"
            >
              How it works
            </Link>
            <Link
              href="#integrations"
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-emerald-800"
            >
              Integrations
            </Link>
            <Link
              href="#security"
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-emerald-800"
            >
              Security
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/guide"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 sm:block"
            >
              Product guide
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-900 hover:shadow-md"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pb-24 pt-32 sm:pt-40 lg:pb-32">
          <div className="landing-grid absolute inset-0 opacity-55 [mask-image:linear-gradient(to_bottom,black_0%,transparent_90%)]" />
          <div className="absolute left-[-15%] top-20 h-[420px] w-[420px] rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="absolute right-[-10%] top-12 h-[500px] w-[500px] rounded-full bg-amber-100/45 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                The people layer of your church
              </div>
              <h1 className="max-w-2xl text-balance text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">
                Know your people.
                <span className="block text-emerald-700">Care with clarity.</span>
              </h1>
              <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-slate-600 sm:text-xl">
                HarvestGen People gives ministry teams one trusted place to
                understand every person, coordinate follow-up, run events, and
                connect the systems that serve your church.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/guide"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(4,120,87,0.8)] transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
                >
                  Explore the platform <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <LockKeyhole className="h-4 w-4 text-emerald-700" />
                  Team sign in
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-500">
                {['Invite-only access', 'Tenant-isolated data', 'Built for ministry teams'].map(
                  (item) => (
                    <span key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

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

        <section className="bg-emerald-950 py-24 text-white sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="relative rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-emerald-300">
                      PERSON PROFILE
                    </div>
                    <div className="mt-1 text-xl font-bold">Alicia Lee</div>
                  </div>
                  <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">
                    Visitor
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Contact', 'alicia@example.com'],
                    ['Campus', 'Bandar Sunway'],
                    ['Household', 'Lee Household'],
                    ['Next step', 'Welcome call'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-black/10 p-4"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/50">
                        {label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/90">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold">Recent activity</span>
                    <span className="text-xs text-emerald-300">Full timeline</span>
                  </div>
                  {[
                    ['Event registration', 'Welcome Lunch', 'Today'],
                    ['Profile created', 'Public registration', 'Today'],
                    ['Follow-up assigned', 'Visitor Care', 'Today'],
                  ].map(([title, detail, date]) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 border-t border-white/10 py-3 first:border-0"
                    >
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">{title}</div>
                        <div className="text-[10px] text-emerald-100/50">{detail}</div>
                      </div>
                      <div className="text-[10px] text-emerald-100/40">{date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                One complete profile
              </div>
              <h2 className="text-balance text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
                See the story, not just the row.
              </h2>
              <p className="mt-6 text-lg leading-8 text-emerald-50/70">
                Give ministry leaders the context they need without making them
                search across forms, chat threads, spreadsheets, and separate
                ministry tools.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'Contact, household, campus, status, and role information',
                  'Custom fields and tags that fit your ministry language',
                  'Chronological activity from People and connected systems',
                  'Pastoral notes and follow-up context in the right place',
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <span className="leading-7 text-emerald-50/85">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                From first contact to meaningful care
              </div>
              <h2 className="text-balance text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
                A clear operating rhythm for your team.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                The system connects data collection, understanding, action, and
                integration in one continuous flow.
              </p>
            </div>

            <div className="relative mt-16 grid gap-4 lg:grid-cols-4">
              <div className="absolute left-[12%] right-[12%] top-8 hidden border-t border-dashed border-emerald-300 lg:block" />
              {operatingSteps.map((step) => (
                <article
                  key={step.number}
                  className="relative rounded-3xl border border-slate-200 bg-white p-6"
                >
                  <div className="relative mb-8 grid h-16 w-16 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700 shadow-[0_0_0_8px_#fbfcf9]">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

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

        <section id="security" className="scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="overflow-hidden rounded-[36px] bg-slate-950 px-6 py-12 text-white sm:px-12 lg:px-16 lg:py-16">
              <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
                <div>
                  <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <h2 className="text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                    Designed for trust from the database up.
                  </h2>
                  <p className="mt-5 text-lg leading-8 text-slate-300">
                    Church data is sensitive. Access is explicit, tenant
                    boundaries are enforced, and integrations receive only the
                    scopes they need.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Tenant isolation', 'Every church operates in its own verified data context.'],
                    ['Role-aware access', 'Owners, admins, and members receive intentional permissions.'],
                    ['Invite-only accounts', 'New users join through expiring, single-use invitations.'],
                    ['Hashed credentials', 'API keys and invitation tokens are never stored in plaintext.'],
                  ].map(([title, description]) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"
                    >
                      <LockKeyhole className="mb-4 h-5 w-5 text-emerald-300" />
                      <div className="font-bold">{title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">
                        {description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-24 sm:pb-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-[36px] border border-emerald-200 bg-emerald-100 px-6 py-16 text-center sm:px-12">
              <div className="landing-grid absolute inset-0 opacity-30" />
              <div className="relative mx-auto max-w-3xl">
                <UserRoundPlus className="mx-auto h-8 w-8 text-emerald-700" />
                <h2 className="mt-5 text-balance text-4xl font-bold tracking-[-0.035em] text-emerald-950 sm:text-5xl">
                  Better care begins with a clearer picture.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-emerald-900/70">
                  Explore how HarvestGen People brings profiles, follow-up,
                  events, and integrations together for your ministry team.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href="/guide"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-950 px-6 text-sm font-bold text-white hover:bg-emerald-900"
                  >
                    Read the product guide <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-emerald-300 bg-white/70 px-6 text-sm font-bold text-emerald-950 hover:bg-white"
                  >
                    Sign in to People
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Brand />
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-500">
              The shared people and relationship system for Harvest Generation
              Church and the wider HarvestGen Church OS.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
            <Link href="/guide" className="hover:text-emerald-700">
              Guide
            </Link>
            <Link href="/login" className="hover:text-emerald-700">
              Sign in
            </Link>
            <span className="text-slate-400">Harvest Generation Church</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
