// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PageHeader, PanelHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'General Settings | People',
};

const sections = [
  {
    href: '/settings/team',
    label: 'Team & invitations',
    description: 'Manage workspace access and expiring invitation links.',
  },
  {
    href: '/settings/fields',
    label: 'Custom fields',
    description: 'Define the additional information stored on people.',
  },
  {
    href: '/settings/tags',
    label: 'Tags',
    description: 'Organize people with reusable, color-coded labels.',
  },
  {
    href: '/settings/api-keys',
    label: 'API keys',
    description: 'Issue scoped credentials for trusted integrations.',
  },
  {
    href: '/settings/webhooks',
    label: 'Webhooks',
    description: 'Deliver selected People events to external systems.',
  },
  {
    href: '/settings/audit-log',
    label: 'Audit log',
    description: 'Review administrative changes and security-sensitive actions.',
  },
];

export default async function SettingsPage() {
  const { churchId, churchName, role } = await requireTenantContext({
    requireManager: true,
  });
  const supabase = createServiceClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [fields, tags, activeKeys, activeWebhooks, recentAuditEvents] = await Promise.all([
    supabase
      .from('field_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('tags')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('is_active', true),
    supabase
      .from('webhooks')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('is_active', true),
    supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .gte('created_at', weekAgo.toISOString()),
  ]);

  const stats = [
    ['Custom fields', fields.count || 0],
    ['Tags', tags.count || 0],
    ['Active API keys', activeKeys.count || 0],
    ['Active webhooks', activeWebhooks.count || 0],
    ['Audit events this week', recentAuditEvents.count || 0],
  ];

  return (
    <WorkspacePage>
      <PageHeader eyebrow="Administration" title="General settings"
        description="Manage access, people fields, tags, and connected tools." />
      <div className="space-y-5">
        <section className="workspace-panel" aria-label="Church workspace">
          <PanelHeader title="Church workspace" />
          <dl className="directory-profile-details px-5 sm:px-6">
            <div><dt>Church</dt><dd>{churchName}</dd></div>
            <div><dt>Your role</dt><dd className="capitalize">{role.replaceAll('_', ' ')}</dd></div>
          </dl>
        </section>

        <section className="workspace-panel" aria-label="Configuration overview">
          <PanelHeader title="Configuration overview" description="Open a section to review or change its settings." />
          <dl className="directory-profile-details px-5 sm:px-6">
            {stats.map(([label, value]) => (
              <div key={String(label)} className="grid-cols-[minmax(0,1fr)_auto]!">
                <dt>{label}</dt><dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="workspace-panel" aria-label="Manage settings">
          <PanelHeader title="Manage settings" />
          <ul className="workspace-rows">
            {sections.map(({ href, label, description }) => (
              <li key={href}>
                <Link href={href} className="workspace-row hover:bg-muted">
                  <div className="workspace-row-content"><h3 className="font-semibold">{label}</h3><p>{description}</p></div>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </WorkspacePage>
  );
}
