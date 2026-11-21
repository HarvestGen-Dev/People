// <!-- AGENT: FRONTEND -->
import { ReactNode } from 'react';
import { SettingsLayoutClient } from './SettingsLayoutClient';
import { requireTenantContext } from '@/lib/tenant-context';
import { canViewSubmissions } from '@/lib/hg-link/access';

const baseSettingsNav = [
  { name: 'General', href: '/settings' },
  { name: 'Team & invitations', href: '/settings/team' },
  { name: 'Custom fields', href: '/settings/fields' },
  { name: 'Tags', href: '/settings/tags' },
  { name: 'Audit log', href: '/settings/audit-log' },
];

const developerSettingsNav = [
  { name: 'API keys', href: '/settings/api-keys' },
  { name: 'Webhooks', href: '/settings/webhooks' },
];

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { role, isPlatformAdmin } = await requireTenantContext();
  const canAccessDeveloperTools =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const canAccessHgLink = canViewSubmissions(role, isPlatformAdmin);
  const hgLinkNav = canAccessHgLink ? [{ name: 'HG Link', href: '/settings/hg-link' }] : [];
  const navItems = canAccessDeveloperTools
    ? [...baseSettingsNav.slice(0, 4), ...hgLinkNav, ...developerSettingsNav, ...baseSettingsNav.slice(4)]
    : [...baseSettingsNav.slice(0, 4), ...hgLinkNav, ...baseSettingsNav.slice(4)];

  return (
    <SettingsLayoutClient navItems={navItems}>
      {children}
    </SettingsLayoutClient>
  );
}
