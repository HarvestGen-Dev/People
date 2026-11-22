// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { TenantContextError, requireTenantContext } from '@/lib/tenant-context';
import { canViewSubmissions } from '@/lib/hg-link/access';
import { getChurchTeam } from '@/lib/team';
import { STATUS_LABELS, getSubmission } from '@/lib/hg-link/submissions';
import { HgLinkTabs } from '../../HgLinkTabs';
import { SubmissionControls } from './SubmissionControls';

export const metadata = { title: 'Submission | HG Links' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const context = await requireTenantContext();
  if (!canViewSubmissions(context.role, context.isPlatformAdmin)) {
    throw new TenantContextError('You do not have access to HG Links submissions', 403);
  }
  const submission = await getSubmission(context.churchId, id);
  if (!submission) notFound();
  const team = await getChurchTeam(context.churchId);
  const assignable = team.members
    .filter((m) => ['owner', 'admin', 'pastoral', 'workflow_manager'].includes(m.role))
    .map((m) => ({ userId: m.userId, email: m.email }));
  const showEditorTabs = context.isPlatformAdmin || context.role === 'owner' || context.role === 'admin';

  return (
    <>
      <Topbar title="Submission" />
      <div className="mx-auto max-w-3xl space-y-5 p-5 sm:p-8">
        <HgLinkTabs active="submissions" showEditorTabs={showEditorTabs} />
        <Link href="/settings/hg-link/submissions" className="inline-flex min-h-11 items-center text-sm underline">← All submissions</Link>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">{submission.person?.name ?? 'Unknown person'}</h2>
          <p className="text-sm text-muted-foreground">{submission.formTitle} · {new Date(submission.createdAt).toLocaleString('en-MY')}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Email</dt><dd>{submission.person?.email ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Phone</dt><dd>{submission.person?.phone ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Workflow</dt><dd>{submission.workflowName ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Status</dt><dd>{STATUS_LABELS[submission.status]}</dd></div>
          </dl>
          {submission.person && <Link href={`/people/${submission.person.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline">Open profile</Link>}
        </section>
        <SubmissionControls submissionId={submission.id} status={submission.status} assignedTo={submission.assignedTo} assignable={assignable} />
        <section aria-labelledby="answers-heading" className="rounded-xl border bg-card p-5">
          <h2 id="answers-heading" className="text-base font-semibold">Answers</h2>
          <p className="mb-3 text-xs text-muted-foreground">May include faith or pastoral information. Share only with people who need it.</p>
          {submission.answers.length === 0 ? <p className="text-sm text-muted-foreground">No extra answers were collected.</p> : (
            <dl className="space-y-3 text-sm">
              {submission.answers.map((a) => <div key={a.label}><dt className="text-muted-foreground">{a.label}</dt><dd className="whitespace-pre-wrap">{a.value}</dd></div>)}
            </dl>
          )}
        </section>
      </div>
    </>
  );
}
