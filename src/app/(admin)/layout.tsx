import React from 'react';
import { AdminShell } from '@/components/layout/AdminShell';
import { requireTenantContext } from '@/lib/tenant-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireTenantContext();

  return <AdminShell>{children}</AdminShell>;
}
