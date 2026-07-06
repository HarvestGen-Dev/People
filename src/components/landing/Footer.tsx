import Link from 'next/link';
import { Brand } from './Brand';

export function Footer() {
  return (
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
  );
}
