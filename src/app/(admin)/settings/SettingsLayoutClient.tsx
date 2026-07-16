'use client';

// <!-- AGENT: FRONTEND -->
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type SettingsNavItem = {
  name: string;
  href: string;
};

export function SettingsLayoutClient({
  children,
  navItems,
}: {
  children: ReactNode;
  navItems: SettingsNavItem[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-slate-200 bg-white lg:w-60 lg:border-b-0 lg:border-r">
        <div className="hidden px-5 pb-3 pt-6 lg:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-700">
            Administration
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Settings</h2>
        </div>
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto px-4 py-3 lg:block lg:space-y-1 lg:px-3 lg:py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 bg-[#f5f7f3]">
        {children}
      </main>
    </div>
  );
}
