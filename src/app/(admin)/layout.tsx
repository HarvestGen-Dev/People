import React from 'react';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { requireTenantContext, TenantContextError } from '@/lib/tenant-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext();
  } catch (error) {
    if (error instanceof TenantContextError) redirect('/account');
    throw error;
  }

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
