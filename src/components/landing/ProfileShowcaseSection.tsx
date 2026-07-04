import { BadgeCheck } from 'lucide-react';

export function ProfileShowcaseSection() {
  return (
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
  );
}
