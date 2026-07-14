// <!-- AGENT: FRONTEND -->
import { ClipboardList, Filter, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Topbar } from '@/components/layout/Topbar';
import { Pagination } from '@/components/ui/pagination';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Audit Log | Settings',
};

const ACTION_OPTIONS = [
  'api_key.created',
  'api_key.revoked',
  'event.created',
  'event.updated',
  'event.deleted',
  'event.duplicated',
  'person.created',
  'person.updated',
  'person.deleted',
  'registration.approved',
  'registration.rejected',
  'tag.created',
  'tag.updated',
  'tag.deleted',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
  'webhook.tested',
];

const RESOURCE_OPTIONS = [
  'api_key',
  'event',
  'person',
  'registration',
  'tag',
  'webhook',
];

type AuditLogRow = {
  action: string;
  resource_type: string;
  resource_display_id: string | null;
  actor_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function labelFromValue(value: string) {
  return value.replaceAll('_', ' ').replaceAll('.', ' ');
}

function metadataSummary(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 3);

  if (!entries.length) return null;

  return entries
    .map(([key, value]) => `${labelFromValue(key)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ');
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();
  const resolvedSearchParams = await searchParams;

  const page =
    typeof resolvedSearchParams.page === 'string'
      ? Math.max(1, parseInt(resolvedSearchParams.page, 10) || 1)
      : 1;
  const actionParam =
    typeof resolvedSearchParams.action === 'string'
      ? resolvedSearchParams.action
      : '';
  const resourceParam =
    typeof resolvedSearchParams.resource === 'string'
      ? resolvedSearchParams.resource
      : '';
  const query =
    typeof resolvedSearchParams.q === 'string'
      ? resolvedSearchParams.q.trim()
      : '';
  const action = ACTION_OPTIONS.includes(actionParam) ? actionParam : '';
  const resource = RESOURCE_OPTIONS.includes(resourceParam) ? resourceParam : '';
  const safeQuery = query.replace(/[,%]/g, '');
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let auditQuery = supabase
    .from('audit_log')
    .select(
      'action, resource_type, resource_display_id, actor_email, ip_address, user_agent, metadata, created_at',
      { count: 'exact' }
    )
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (action) {
    auditQuery = auditQuery.eq('action', action);
  }

  if (resource) {
    auditQuery = auditQuery.eq('resource_type', resource);
  }

  if (safeQuery) {
    auditQuery = auditQuery.or(
      `actor_email.ilike.%${safeQuery}%,resource_display_id.ilike.%${safeQuery}%`
    );
  }

  const { data, error, count } = await auditQuery;
  if (error) throw error;

  const rows = (data || []) as AuditLogRow[];
  const hasFilters = Boolean(action || resource || query);

  return (
    <>
      <Topbar title="Audit log" />
      <div className="mx-auto max-w-6xl space-y-6 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
              Accountability
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">
              Audit log
            </h1>
            <p className="mt-2 max-w-2xl text-slate-500">
              Review administrative actions without exposing database identifiers.
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <ClipboardList className="h-5 w-5" />
          </div>
        </header>

        <form className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search actor email or display ID"
                className="h-11 w-full rounded-xl border border-transparent bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
              />
            </div>
            <select
              name="action"
              defaultValue={action}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300"
            >
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelFromValue(option)}
                </option>
              ))}
            </select>
            <select
              name="resource"
              defaultValue={resource}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300"
            >
              <option value="">All resources</option>
              {RESOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelFromValue(option)}
                </option>
              ))}
            </select>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-800">
              <Filter className="h-4 w-4" />
              Apply
            </button>
          </div>
          {hasFilters && (
            <a
              href="/settings/audit-log"
              className="mt-3 inline-flex text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Clear filters
            </a>
          )}
        </form>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="font-bold text-slate-950">
              {count?.toLocaleString() || 0} audit events
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Newest administrative actions appear first.
            </p>
          </div>

          {!rows.length ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No audit events match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => {
                const details = metadataSummary(row.metadata);

                return (
                  <article
                    key={`${row.created_at}-${row.action}-${row.resource_display_id || row.actor_email || 'event'}`}
                    className="px-5 py-4 sm:px-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                            {labelFromValue(row.action)}
                          </span>
                          <span className="text-sm font-bold text-slate-950">
                            {labelFromValue(row.resource_type)}
                          </span>
                          {row.resource_display_id && (
                            <code className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              {row.resource_display_id}
                            </code>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {row.actor_email || 'Unknown actor'}
                        </p>
                        {details && (
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {details}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-xs font-bold text-slate-500">
                          {formatDistanceToNow(new Date(row.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                        <p className="mt-1 max-w-[18rem] truncate text-[11px] text-slate-400">
                          {row.ip_address || 'No IP recorded'}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <Pagination total={count || 0} pageSize={pageSize} />
      </div>
    </>
  );
}
