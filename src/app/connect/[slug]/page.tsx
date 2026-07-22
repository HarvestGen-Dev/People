// <!-- AGENT: FRONTEND -->
import { notFound } from 'next/navigation';
import { HeartHandshake, ShieldCheck } from 'lucide-react';
import { PublicConnectForm } from '@/components/connect-forms/PublicConnectForm';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ConnectFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: form, error } = await supabase
    .from('connect_forms')
    .select('slug, title, description, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !form) notFound();

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-slate-950">
      <header className="border-b border-white/10 bg-emerald-950 text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5 sm:px-8">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-emerald-950">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-300">
              HarvestGen
            </div>
            <div className="text-sm font-bold">Connect</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1fr_440px] lg:items-start">
        <section>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Stay connected
          </div>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold text-slate-950 sm:text-5xl">
            {form.title}
          </h1>
          {form.description && (
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              {form.description}
            </p>
          )}
          <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Your details are sent securely to the church team.
          </div>
        </section>

        <section
          aria-labelledby="connect-details-heading"
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)] sm:p-7"
        >
          <h2 id="connect-details-heading" className="text-xl font-bold text-slate-950">
            Your details
          </h2>
          <p className="mt-1 text-sm text-slate-500">Fields marked required must be completed.</p>
          <PublicConnectForm slug={form.slug} title={form.title} />
        </section>
      </div>
    </main>
  );
}
