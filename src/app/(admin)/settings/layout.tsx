// <!-- AGENT: FRONTEND -->
import { ReactNode } from 'react';
import { SettingsLayoutClient } from './SettingsLayoutClient';
import { requireTenantContext } from '@/lib/tenant-context';

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
  const navItems = canAccessDeveloperTools
    ? [...baseSettingsNav.slice(0, 4), ...developerSettingsNav, ...baseSettingsNav.slice(4)]
    : baseSettingsNav;

  return (
    <SettingsLayoutClient navItems={navItems}>
      {children}
    </SettingsLayoutClient>
  );
}
