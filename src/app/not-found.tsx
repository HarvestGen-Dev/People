// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f3] p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          404
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Page not found
        </h1>
        <p className="mt-3 leading-7 text-slate-500">
          The page may have moved, been removed, or belong to another church.
        </p>
        <Link
          href="/account"
          className="mt-7 inline-flex h-10 items-center rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to People
        </Link>
      </section>
    </main>
  );
}
