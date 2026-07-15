'use client';

// <!-- AGENT: FRONTEND -->
import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { LogOut } from 'lucide-react';
import type { TenantRole } from '@/lib/tenant-context';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  accountNavItem,
  primaryNav,
  type AdminNavItem,
} from '@/components/layout/admin-nav';

function useSignOut() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  return async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
}

export function MobileAccountMenu({
  userEmail,
  compact = false,
  label = 'Account',
}: {
  userEmail: string;
  compact?: boolean;
  label?: string;
}) {
  const handleSignOut = useSignOut();
  const AccountIcon = accountNavItem.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className={cn(
          compact
            ? 'grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50'
            : 'flex h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800'
        )}
      >
        {compact ? (
          <Avatar className="h-7 w-7 border border-emerald-200">
            <AvatarFallback className="bg-emerald-100 text-[11px] font-bold text-emerald-700">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
        ) : (
          <>
            <AccountIcon className="h-5 w-5 text-slate-400" />
            <span className="max-w-full truncate">{label}</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <DropdownMenuLabel>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Signed in
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
            {userEmail || 'Signed-in account'}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-600">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function navItemsForRole(role: TenantRole): Array<AdminNavItem | typeof accountNavItem> {
  if (role === 'workflow_manager') {
    return [
      primaryNav[0],
      primaryNav[3],
      primaryNav[2],
      primaryNav[4],
      accountNavItem,
    ];
  }

  return primaryNav;
}

export function MobileBottomNav({
  userEmail,
  role,
}: {
  userEmail: string;
  role: TenantRole;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/94 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_45px_-35px_rgba(15,23,42,0.65)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isAccount = item.href === accountNavItem.href;
          const isActive =
            !isAccount &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));

          if (isAccount) {
            return (
              <div key={item.href} className="min-w-0">
                <MobileAccountMenu
                  userEmail={userEmail}
                  label={item.shortLabel}
                />
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  isActive ? 'text-emerald-700' : 'text-slate-400'
                )}
              />
              <span className="max-w-full truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
