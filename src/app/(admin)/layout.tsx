import React from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { requireTenantContext } from '@/lib/tenant-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenantContext();

  return (
    <AdminShell
      userEmail={tenant.user.email || 'Signed-in account'}
      role={tenant.role}
      isPlatformAdmin={tenant.isPlatformAdmin}
    >
      {children}
    </AdminShell>
  );
}
