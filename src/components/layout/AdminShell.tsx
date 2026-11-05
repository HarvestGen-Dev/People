// <!-- AGENT: FRONTEND -->
import { Sidebar, WorkspaceTopbar } from '@/components/layout/Sidebar';
import { AdminPermissionsProvider } from '@/components/layout/AdminPermissions';
import type { TenantRole } from '@/lib/tenant-context';

export function AdminShell({ children, userEmail, role, isPlatformAdmin }: {
  children: React.ReactNode;
  userEmail: string;
  role: TenantRole;
  isPlatformAdmin: boolean;
}) {
  const account = { userEmail, role, isPlatformAdmin };
  return (
    <AdminPermissionsProvider role={role} isPlatformAdmin={isPlatformAdmin}>
      <div className="people-workspace flex min-h-dvh min-w-0">
        <a href="#workspace-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:p-3">
          Skip to content
        </a>
        <Sidebar {...account} />
        <div className="min-w-0 flex-1">
          <WorkspaceTopbar {...account} />
          <main id="workspace-main" tabIndex={-1} className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </AdminPermissionsProvider>
  );
}
