// <!-- AGENT: BACKEND -->
import 'server-only';
import type { TenantContext } from '@/lib/tenant-context';

export function canAccessChurchOffice(tenant: TenantContext) {
  return tenant.churchSlug === 'harvestgen'
    && Boolean(tenant.user.email_confirmed_at)
    && tenant.user.email?.trim().toLowerCase() === 'felicia.tanwijaya@gmail.com'
    && (tenant.role === 'owner' || tenant.role === 'admin');
}
