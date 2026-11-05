'use client';

// <!-- AGENT: FRONTEND -->
import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CalendarDays, ChevronLeft, ChevronRight, Code2, GitBranch, LayoutDashboard,
  LayoutList, LogOut, Menu, Network, Settings, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TenantRole } from '@/lib/tenant-context';
import { startNavigationProgress } from '@/lib/navigation-progress';

const primaryNav = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Follow-ups', href: '/workflows', icon: GitBranch },
  { label: 'Events', href: '/events', icon: CalendarDays },
  { label: 'Lists', href: '/lists', icon: LayoutList },
];

const administrationNav = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Developer', href: '/developer', icon: Code2 },
  { label: 'Platform', href: '/platform', icon: Network },
];

type Account = { userEmail: string; role: TenantRole; isPlatformAdmin: boolean };

function SidebarContents({ account, collapsed = false, close }: {
  account: Account; collapsed?: boolean; close?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { userEmail, role, isPlatformAdmin } = account;
  const canAccessDeveloperTools = isPlatformAdmin || role === 'owner' || role === 'admin';
  const adminNav = administrationNav.filter(({ href }) =>
    href === '/platform' ? isPlatformAdmin : canAccessDeveloperTools);

  async function handleSignOut() {
    const { createBrowserClient } = await import('@supabase/ssr');
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    close?.();
    startNavigationProgress();
    router.push('/login');
  }

  function renderLinks(items: typeof primaryNav) {
    return items.map(({ label, href, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return (
        <Link key={href} href={href} prefetch={false} onNavigate={close}
          aria-current={active ? 'page' : undefined}
          title={collapsed ? label : undefined}
          className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold',
            active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-0')}>
          <Icon size={18} aria-hidden="true" className="shrink-0" />
          <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
        </Link>
      );
    });
  }

  return (
    <>
      <div className={cn('flex min-h-20 shrink-0 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
        <Link href="/dashboard" onNavigate={close} className="flex min-w-0 items-center gap-3 rounded-md" aria-label="Harvest Generation People">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-lg font-bold tracking-tight text-white">hg</span>
          <span className={collapsed ? 'sr-only' : 'min-w-0'}>
            <span className="block text-[10px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Harvest Generation</span>
            <span className="block text-lg font-bold tracking-tight">People</span>
          </span>
        </Link>
        {close && <button type="button" aria-label="Close navigation" className="workspace-button ml-auto size-11 p-0" onClick={close}><X size={18} /></button>}
      </div>
      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className={collapsed ? 'sr-only' : 'mb-2 px-3 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground'}>Workspace</p>
        <div className="space-y-1">{renderLinks(primaryNav)}</div>
        {!!adminNav.length && (
          <div className="mt-6">
            <p className={collapsed ? 'sr-only' : 'mb-2 px-3 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground'}>Administration</p>
            <div className="space-y-1">{renderLinks(adminNav)}</div>
          </div>
        )}
      </nav>
      <div className={cn('flex shrink-0 items-center gap-2 border-t p-3', collapsed && 'flex-col')}>
        {!collapsed && <>
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">{userEmail[0]?.toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p title={userEmail} className="truncate text-xs font-semibold">{userEmail}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Church workspace</p>
          </div>
        </>}
        <button type="button" onClick={handleSignOut} aria-label="Sign out" title="Sign out" className="workspace-link size-11 shrink-0 p-0">
          <LogOut size={16} />
        </button>
      </div>
    </>
  );
}

export function Sidebar(account: Account) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card md:flex', collapsed ? 'w-[4.5rem]' : 'w-48 xl:w-[14.75rem]')}>
      <SidebarContents account={account} collapsed={collapsed} />
      <div className="flex shrink-0 justify-center border-t px-2">
        <button type="button" className="workspace-link" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

export function WorkspaceTopbar(account: Account) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const section = [...primaryNav, ...administrationNav].find(({ href }) =>
    pathname === href || pathname.startsWith(`${href}/`));
  const close = () => dialog.current?.close();
  return (
    <header className="flex min-h-16 items-center gap-3 border-b bg-card px-[var(--workspace-gutter)] md:min-h-[4.75rem]">
      <button type="button" className="workspace-button size-11 p-0 md:hidden" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <Menu size={18} />
      </button>
      <span className="hidden text-xs text-muted-foreground md:inline">Workspace <span aria-hidden="true" className="ms-2">/</span></span>
      <span className="text-[13px] font-semibold">{section?.label ?? 'People'}</span>
      <dialog ref={dialog} className="workspace-dialog" data-side="left" aria-label="Workspace navigation"
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="flex min-h-full flex-col">
          <SidebarContents account={account} close={close} />
        </div>
      </dialog>
    </header>
  );
}
