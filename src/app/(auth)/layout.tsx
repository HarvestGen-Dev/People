import React from 'react';
import Link from 'next/link';
import { Check, Users } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-[#f7f8f5] lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col">
        <div className="landing-grid absolute inset-0 opacity-10" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-xs font-black text-emerald-950">
            HG
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              HarvestGen
            </div>
            <div className="mt-1 text-sm font-bold">People</div>
          </div>
        </Link>
        <div className="relative my-auto max-w-lg">
          <Users className="mb-8 h-10 w-10 text-emerald-300" />
          <h1 className="text-balance text-5xl font-bold leading-[1.04] tracking-[-0.04em]">
            One place to know and care for your people.
          </h1>
          <p className="mt-6 text-lg leading-8 text-emerald-50/65">
            Profiles, follow-up, events, and connected ministry systems—all in
            one secure church workspace.
          </p>
          <div className="mt-9 space-y-4">
            {[
              'A shared source of truth for every ministry',
              'Clear follow-up ownership and next steps',
              'Secure, invite-only access for your team',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-semibold text-emerald-50/85">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-emerald-100/35">
          Harvest Generation Church · People OS
        </div>
      </div>

      <div className="flex min-h-screen flex-col">
        <div className="flex h-20 items-center px-5 lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-950 text-[10px] font-black text-white">
              HG
            </div>
            <span className="font-bold tracking-tight text-slate-950">
              HarvestGen People
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
