import Link from 'next/link';
import { ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react';
import { ProductPreview } from './ProductPreview';

export function HeroSection() {
  return (
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
  );
}
