import Link from 'next/link';
import { ArrowRight, UserRoundPlus } from 'lucide-react';

export function CtaSection() {
  return (
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
  );
}
