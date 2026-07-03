'use client';

// <!-- AGENT: FRONTEND -->
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Retry the request. If it continues, return to the dashboard and check
          your access to this church.
        </p>
        <Button
          onClick={reset}
          className="mt-6 h-10 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </section>
    </div>
  );
}
