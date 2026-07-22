// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  MailWarning,
  RefreshCw,
  Webhook,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import {
  requireTenantContext,
  TenantSelectionRequiredError,
} from '@/lib/tenant-context';
import {
  loadOperationalHealth,
  type HealthResult,
  type HealthState,
} from '@/lib/observability/health';

export const metadata = { title: 'Operational Health | People' };
export const dynamic = 'force-dynamic';

const statusConfig = {
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  critical: {
    label: 'Critical',
    icon: AlertTriangle,
    className: 'border-red-200 bg-red-50 text-red-800',
  },
  unknown: {
    label: 'Unavailable',
    icon: CircleHelp,
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
} satisfies Record<HealthState, { label: string; icon: typeof Activity; className: string }>;

function StatusBadge({ state, area }: { state: HealthState; area: string }) {
  const config = statusConfig[state];
  const Icon = config.icon;
  return (
    <span
      aria-label={`${area} status: ${config.label}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function Timestamp({ value }: { value: string | null }) {
  if (!value) return <span>None recorded</span>;
  const date = new Date(value);
  return (
    <time dateTime={value} title={format(date, 'PPpp')}>
      {formatDistanceToNow(date, { addSuffix: true })}
      <span className="sr-only"> ({format(date, 'PPpp')})</span>
    </time>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-slate-100 py-3 sm:border-t-0 sm:border-l sm:px-4 sm:first:border-l-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-slate-950">{value}</dd>
    </div>
  );
}

function UnavailableSection({ title, icon: Icon }: { title: string; icon: typeof Activity }) {
  return (
    <section aria-labelledby={`${title}-heading`} className="border-t border-slate-200 py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${title}-heading`} className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <Icon className="h-5 w-5 text-slate-500" aria-hidden="true" />
          {title}
        </h2>
        <StatusBadge state="unknown" area={title} />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        This summary could not be loaded. Other sections remain independent; check structured server logs before treating this area as healthy.
      </p>
    </section>
  );
}

function SectionShell<T>({
  title,
  icon: Icon,
  result,
  description,
  action,
  href,
  children,
}: {
  title: string;
  icon: typeof Activity;
  result: HealthResult<T>;
  description: string;
  action: string;
  href?: string;
  children: (data: T) => React.ReactNode;
}) {
  if (!result.available) return <UnavailableSection title={title} icon={Icon} />;
  return (
    <section aria-labelledby={`${title}-heading`} className="border-t border-slate-200 py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${title}-heading`} className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          {title}
        </h2>
        <StatusBadge state={result.state} area={title} />
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      <dl className="mt-5 grid border-y border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        {children(result.data)}
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600"><span className="font-semibold text-slate-800">Operator action:</span> {action}</p>
        {href ? <Link className="font-bold text-emerald-700 hover:text-emerald-900" href={href}>Open management page</Link> : null}
      </div>
    </section>
  );
}

export default async function OperationalHealthPage() {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext({ requireSelectedChurch: true });
  } catch (error) {
    if (error instanceof TenantSelectionRequiredError) redirect('/platform');
    throw error;
  }
  if (!tenant.isPlatformAdmin && tenant.role !== 'owner' && tenant.role !== 'admin') {
    redirect('/dashboard');
  }
  const health = await loadOperationalHealth(tenant.churchId);
  const overall = statusConfig[health.overall];
  const OverallIcon = overall.icon;

  return (
    <>
      <Topbar title="Operational Health" />
      <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-700">Production operations</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Operational health</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Tenant-scoped delivery, integration, and scheduled-job signals for {tenant.churchName}.
            </p>
          </div>
          <Link href="/developer" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
            Back to developer tools
          </Link>
        </header>

        <div className={`mt-7 flex items-start gap-3 rounded-lg border p-4 ${overall.className}`} role="status">
          <OverallIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Overall status: {overall.label}</p>
            <p className="mt-1 text-sm">
              {health.overall === 'unknown'
                ? 'At least one summary is unavailable. Do not interpret missing data as healthy.'
                : health.overall === 'healthy'
                  ? 'No current threshold requires operator attention.'
                  : 'One or more areas require operator review.'}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <SectionShell
            title="Registrations"
            icon={CalendarClock}
            result={health.registration}
            description="Pending review is a business queue, not a technical failure. Technical submission and review failures are counted separately."
            action="Review queues older than 24 hours and search Vercel logs by the matching structured event when a technical failure is present."
            href="/events"
          >
            {(data) => <>
              <Metric label="Pending review" value={data.pending_review_count} />
              <Metric label="Payment review" value={data.payment_review_count} />
              <Metric label="Technical failures (24h)" value={data.submission_failures_24h + data.approval_failures_24h} />
              <Metric label="Oldest pending" value={<Timestamp value={data.oldest_pending_at} />} />
            </>}
          </SectionShell>

          <SectionShell
            title="Email and SMTP"
            icon={MailWarning}
            result={health.email}
            description="A confirmation claim is stuck only after the actual five-minute lease expires. Active younger claims are normal."
            action="Verify Brevo credentials and sender configuration; retry through the existing registration approval flow rather than editing claim timestamps manually."
            href="/events"
          >
            {(data) => <>
              <Metric label="Eligible to send" value={data.eligible_to_send_count} />
              <Metric label="Stuck claims" value={data.stuck_claim_count} />
              <Metric label="SMTP failures (24h)" value={data.smtp_failures_24h} />
              <Metric label="Last success" value={<Timestamp value={data.last_success_at} />} />
            </>}
          </SectionShell>

          <SectionShell
            title="Webhooks"
            icon={Webhook}
            result={health.webhooks}
            description="Retry-scheduled deliveries remain recoverable. Permanent failures and processing beyond the 60-second lease require attention."
            action="Inspect the configured endpoint and use the existing single-delivery retry control after correcting the destination."
            href="/settings/webhooks"
          >
            {(data) => <>
              <Metric label="Due now" value={data.pending_due_count} />
              <Metric label="Retry scheduled" value={data.retry_scheduled_count} />
              <Metric label="Permanent failures" value={data.permanently_failed_count} />
              <Metric label="Last success" value={<Timestamp value={data.last_success_at} />} />
            </>}
          </SectionShell>

          <SectionShell
            title="Missing-person pulse"
            icon={RefreshCw}
            result={health.pulse}
            description="A single lock skip is expected concurrency control. Repeated skips, scoped failures, or a run left running for 30 minutes require review."
            action="Inspect pulse run history and configuration failures; do not manually insert cards or rewrite run statuses."
            href="/workflows"
          >
            {(data) => <>
              <Metric label="Lock skips (24h)" value={data.lock_skips_24h} />
              <Metric label="Latest failed configs" value={data.latest_run_failed_configs} />
              <Metric label="Abandoned runs" value={data.abandoned_running_count} />
              <Metric label="Last success" value={<Timestamp value={data.last_success_at} />} />
            </>}
          </SectionShell>
        </div>
      </main>
    </>
  );
}
