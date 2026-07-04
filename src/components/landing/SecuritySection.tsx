import { LockKeyhole, ShieldCheck } from 'lucide-react';

export function SecuritySection() {
  return (
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
  );
}
