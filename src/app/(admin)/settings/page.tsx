// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  ArrowRight,
  Braces,
  ClipboardList,
  KeyRound,
  Tags,
  Users,
  Webhook,
} from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
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
    icon: Users,
  },
  {
    href: '/settings/fields',
    label: 'Custom fields',
    description: 'Define the additional information stored on people.',
    icon: Braces,
  },
  {
    href: '/settings/tags',
    label: 'Tags',
    description: 'Organize people with reusable, color-coded labels.',
    icon: Tags,
  },
  {
    href: '/settings/api-keys',
    label: 'API keys',
    description: 'Issue scoped credentials for trusted integrations.',
    icon: KeyRound,
  },
  {
    href: '/settings/webhooks',
    label: 'Webhooks',
    description: 'Deliver selected People events to external systems.',
    icon: Webhook,
  },
  {
    href: '/settings/audit-log',
    label: 'Audit log',
    description: 'Review administrative changes and security-sensitive actions.',
    icon: ClipboardList,
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
    <>
      <Topbar title="General settings" />
      <div className="mx-auto max-w-6xl space-y-8 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <header>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Workspace
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">
            General settings
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Review the identity and configuration of your People workspace.
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="font-bold text-slate-950">Church workspace</h2>
            <p className="mt-1 text-xs text-slate-500">
              This identity scopes people, integrations, and administrative access.
            </p>
          </div>
          <dl className="grid gap-px bg-slate-100 sm:grid-cols-2">
            <div className="bg-white px-5 py-5 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Church name
              </dt>
              <dd className="mt-2 text-base font-bold text-slate-950">{churchName}</dd>
            </div>
            <div className="bg-white px-5 py-5 sm:px-6">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your access
              </dt>
              <dd className="mt-2 capitalize text-base font-bold text-slate-950">{role}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="configuration-heading">
          <div className="mb-4">
            <h2 id="configuration-heading" className="font-bold text-slate-950">
              Configuration overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Open a section to review or change its settings.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {stats.map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-2xl font-bold text-slate-950">{value}</div>
                <div className="mt-1 text-sm text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-950">{label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
