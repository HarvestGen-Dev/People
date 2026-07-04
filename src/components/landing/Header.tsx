import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Brand } from './Brand';

export function Header() {
  return (
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
  );
}
