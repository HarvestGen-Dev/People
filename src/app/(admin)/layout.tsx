import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { requireTenantContext } from '@/lib/tenant-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireTenantContext();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Topbar title="People" />
        <main className="flex-1 overflow-y-auto bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
