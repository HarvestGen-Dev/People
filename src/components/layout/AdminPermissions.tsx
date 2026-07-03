'use client';

import { createContext, useContext } from 'react';
import type { TenantRole } from '@/lib/tenant-context';

type AdminPermissions = {
  role: TenantRole;
  canManage: boolean;
  isPlatformAdmin: boolean;
};

const AdminPermissionsContext = createContext<AdminPermissions | null>(null);

export function AdminPermissionsProvider({
  role,
  isPlatformAdmin,
  children,
}: {
  role: TenantRole;
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminPermissionsContext.Provider
      value={{
        role,
        canManage:
          isPlatformAdmin || role === 'owner' || role === 'admin',
        isPlatformAdmin,
      }}
    >
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions(): AdminPermissions {
  const permissions = useContext(AdminPermissionsContext);
  if (!permissions) {
    throw new Error(
      'useAdminPermissions must be used inside AdminPermissionsProvider'
    );
  }
  return permissions;
}
