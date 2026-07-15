'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  MobileAccountMenu,
  MobileBottomNav,
} from '@/components/layout/MobileBottomNav';
import {
  AdminPermissionsProvider,
} from '@/components/layout/AdminPermissions';
import type { TenantRole } from '@/lib/tenant-context';

export function AdminShell({
  children,
  userEmail,
  role,
  isPlatformAdmin,
}: {
  children: React.ReactNode;
  userEmail: string;
  role: TenantRole;
  isPlatformAdmin: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const usesBottomNav =
    !isPlatformAdmin && (role === 'member' || role === 'workflow_manager');

  return (
    <AdminPermissionsProvider
      role={role}
      isPlatformAdmin={isPlatformAdmin}
    >
      <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-[#f5f7f3] md:h-screen md:overflow-hidden">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          userEmail={userEmail}
          role={role}
          isPlatformAdmin={isPlatformAdmin}
        />
        <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
          <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl md:hidden">
            {!usesBottomNav && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="ml-3">
              <div className="text-[9px] font-bold uppercase tracking-[0.17em] text-emerald-700">
                HarvestGen
              </div>
              <div className="text-sm font-bold text-slate-950">People</div>
            </div>
            {usesBottomNav && role === 'member' && (
              <div className="ml-auto">
                <MobileAccountMenu userEmail={userEmail} compact />
              </div>
            )}
          </div>
          <main className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${usesBottomNav ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0' : ''}`}>
            {children}
          </main>
          {usesBottomNav && (
            <MobileBottomNav userEmail={userEmail} role={role} />
          )}
        </div>
      </div>
    </AdminPermissionsProvider>
  );
}
