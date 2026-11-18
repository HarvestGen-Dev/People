// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantContextError, requireTenantContext } from '@/lib/tenant-context';
import { canViewSubmissions } from '@/lib/hg-link/access';
import { getChurchTeam } from '@/lib/team';
import { FOLLOW_UP_STATUSES, STATUS_LABELS, listSubmissions, parseFilters } from '@/lib/hg-link/submissions';
import { HgLinkTabs } from '../HgLinkTabs';

export const metadata = { title: 'HG Link submissions | Settings' };
export const dynamic = 'force-dynamic';

const selectClass = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm';

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requireTenantContext();
  // Submissions can hold faith and pastoral information: explicit role allow-list.
  if (!canViewSubmissions(context.role, context.isPlatformAdmin)) {
    throw new TenantContextError('You do not have access to HG Link submissions', 403);
  }
  const filters = parseFilters(await searchParams);
  const supabase = createServiceClient();
  const [rows, { data: forms }, team] = await Promise.all([
    listSubmissions(context.churchId, filters),
    supabase.from('connect_forms').select('id, title').eq('church_id', context.churchId).order('title'),
    getChurchTeam(context.churchId),
  ]);
  const assignable = team.members.filter((m) => ['owner', 'admin', 'pastoral', 'workflow_manager'].includes(m.role));
  const emailById = new Map(team.members.map((m) => [m.userId, m.email]));
  const showEditorTabs = context.isPlatformAdmin || context.role === 'owner' || context.role === 'admin';

  return (
    <>
      <Topbar title="HG Link submissions" />
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <HgLinkTabs active="submissions" showEditorTabs={showEditorTabs} />
        <form method="get" aria-label="Filter submissions" className="mb-5 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div><label htmlFor="flt-form" className="mb-1 block text-sm font-medium">Form</label>
            <select id="flt-form" name="form" defaultValue={filters.formId ?? ''} className={selectClass}>
              <option value="">All forms</option>{(forms ?? []).map((f) => <option key={f.id as string} value={f.id as string}>{f.title as string}</option>)}
            </select></div>
          <div><label htmlFor="flt-status" className="mb-1 block text-sm font-medium">Status</label>
            <select id="flt-status" name="status" defaultValue={filters.status ?? ''} className={selectClass}>
              <option value="">Any status</option>{FOLLOW_UP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select></div>
          <div><label htmlFor="flt-assignee" className="mb-1 block text-sm font-medium">Assigned to</label>
            <select id="flt-assignee" name="assignee" defaultValue={filters.assignee ?? ''} className={selectClass}>
              <option value="">Anyone</option><option value="none">Unassigned</option>
              {assignable.map((m) => <option key={m.userId} value={m.userId}>{m.email}</option>)}
            </select></div>
          <div><label htmlFor="flt-from" className="mb-1 block text-sm font-medium">From</label>
            <input id="flt-from" type="date" name="from" defaultValue={filters.from ?? ''} className={selectClass} /></div>
          <div><label htmlFor="flt-to" className="mb-1 block text-sm font-medium">To</label>
            <input id="flt-to" type="date" name="to" defaultValue={filters.to ?? ''} className={selectClass} /></div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Apply filters</button>
            <Link href="/settings/hg-link/submissions" className="inline-flex min-h-11 items-center px-3 text-sm underline">Clear</Link>
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No submissions match. New responses from HG Link forms will appear here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">HG Link submissions, newest first</caption>
              <thead className="border-b text-xs text-muted-foreground">
                <tr><th scope="col" className="p-3">Submitted</th><th scope="col" className="p-3">Form</th><th scope="col" className="p-3">Person</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Assigned</th><th scope="col" className="p-3">Workflow</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString('en-MY', { dateStyle: 'medium' })}</td>
                    <td className="p-3">{row.formTitle}</td>
                    <td className="p-3">
                      <Link href={`/settings/hg-link/submissions/${row.id}`} className="font-semibold underline-offset-4 hover:underline">{row.person?.name ?? 'Unknown'}</Link>
                      <span className="block text-xs text-muted-foreground">{row.person?.email ?? row.person?.phone ?? ''}</span>
                    </td>
                    <td className="p-3">{STATUS_LABELS[row.status]}</td>
                    <td className="p-3">{row.assignedTo ? emailById.get(row.assignedTo) ?? 'Former member' : 'Unassigned'}</td>
                    <td className="p-3">{row.workflowName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
