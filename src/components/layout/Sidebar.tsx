'use client';

// <!-- AGENT: FRONTEND -->
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitBranch,
  LayoutDashboard,
  LayoutList,
  Network,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TenantRole } from '@/lib/tenant-context';

const primaryNav = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Lists', href: '/lists', icon: LayoutList },
  { label: 'Workflows', href: '/workflows', icon: GitBranch },
  { label: 'Events', href: '/events', icon: CalendarDays },
];

const administrationNav = [
  { label: 'Developer', href: '/developer', icon: Code2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  userEmail: string;
  role: TenantRole;
  isPlatformAdmin: boolean;
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  userEmail,
  role,
  isPlatformAdmin,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const renderNavItem = (item: (typeof primaryNav)[number]) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    const content = (
      <Link
        href={item.href}
        onClick={onMobileClose}
        className={cn(
          'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
          isActive
            ? 'bg-white/12 text-white shadow-sm'
            : 'text-emerald-50/62 hover:bg-white/[0.07] hover:text-white',
          isCollapsed && 'md:justify-center md:px-0'
        )}
      >
        <Icon
          className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors',
            isActive
              ? 'text-emerald-300'
              : 'text-emerald-100/45 group-hover:text-emerald-200'
          )}
        />
        <span className={cn(isCollapsed && 'md:hidden')}>{item.label}</span>
        {isActive && !isCollapsed && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-300" />
        )}
      </Link>
    );

    if (!isCollapsed) {
      return <div key={item.href}>{content}</div>;
    }

    return (
      <Tooltip key={item.href}>
        <TooltipTrigger render={content} className="hidden md:flex" />
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-all duration-300 md:static md:translate-x-0 md:shadow-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'w-[272px] md:w-[72px]' : 'w-[272px]'
        )}
      >
        <div className="flex h-[72px] shrink-0 items-center border-b border-white/[0.07] px-4">
          <Link
            href="/dashboard"
            onClick={onMobileClose}
            className={cn(
              'flex min-w-0 items-center gap-3',
              isCollapsed && 'md:mx-auto'
            )}
          >
            <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/20">
              <span className="absolute h-7 w-3 rotate-45 rounded-full bg-white/35" />
              <span className="relative text-[10px] font-black">HG</span>
            </div>
            <div className={cn('min-w-0', isCollapsed && 'md:hidden')}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                HarvestGen
              </div>
              <div className="mt-1 text-sm font-bold text-white">People</div>
            </div>
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-emerald-100/60 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div
            className={cn(
              'mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/35',
              isCollapsed && 'md:text-center md:text-[0]'
            )}
          >
            Workspace
          </div>
          <div className="space-y-1">{primaryNav.map(renderNavItem)}</div>

          <div className="my-5 border-t border-white/[0.07]" />

          <div
            className={cn(
              'mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/35',
              isCollapsed && 'md:text-center md:text-[0]'
            )}
          >
            Administration
          </div>
          <div className="space-y-1">
          {[
            ...(isPlatformAdmin
              ? [{ label: 'Platform', href: '/platform', icon: Network }]
              : []),
            ...(role === 'member' && !isPlatformAdmin
              ? []
              : administrationNav),
          ].map(renderNavItem)}
          </div>
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2',
              isCollapsed && 'md:justify-center md:bg-transparent md:p-0'
            )}
          >
            <Avatar className="h-9 w-9 border border-white/10">
              <AvatarFallback className="bg-emerald-400 text-xs font-bold text-emerald-950">
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className={cn('min-w-0 flex-1', isCollapsed && 'md:hidden')}>
              <div className="truncate text-xs font-semibold text-white">
                {userEmail || 'Loading account'}
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-100/45">
                Church workspace
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-emerald-100/45 transition-colors hover:bg-white/10 hover:text-white',
                isCollapsed && 'md:hidden'
              )}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="hidden border-t border-white/[0.07] p-2 md:flex md:justify-center">
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="grid h-8 w-8 place-items-center rounded-lg text-emerald-100/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
