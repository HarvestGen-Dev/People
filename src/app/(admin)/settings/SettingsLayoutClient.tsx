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
    <div className="min-w-0">
      <nav aria-label="Settings" className="flex flex-wrap gap-x-4 border-b bg-card px-[var(--workspace-gutter)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined}
              className={cn('inline-flex min-h-11 items-center border-b-2 text-[13px] font-semibold',
                isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-primary')}>
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
