// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MailWarning,
  ShieldQuestion,
  TicketCheck,
  Webhook,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireTenantContext } from '@/lib/tenant-context';
import {
  getReviewQueue,
  type ReviewQueueItem,
} from '@/lib/review-queue';

export const metadata = {
  title: 'Review Queue | People',
};

const statCards = [
  {
    key: 'pendingRegistrations',
    label: 'Registrations',
    detail: 'Awaiting review',
    icon: TicketCheck,
    color: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'claimRequests',
    label: 'Profile claims',
    detail: 'Need approval',
    icon: ShieldQuestion,
    color: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'stuckEmails',
    label: 'Email outbox',
    detail: 'Approved but unsent',
    icon: MailWarning,
    color: 'bg-rose-100 text-rose-700',
  },
  {
    key: 'webhookFailures',
    label: 'Webhooks',
    detail: 'Failed deliveries',
    icon: Webhook,
    color: 'bg-violet-100 text-violet-700',
  },
] as const;

function QueueSection({
  title,
  description,
  items,
  empty,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  items: ReviewQueueItem[];
  empty: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <Link href={actionHref}>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit rounded-xl font-bold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {actionLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">{empty}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group grid gap-3 px-5 py-4 transition-colors hover:bg-emerald-50/40 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                    {item.title}
                  </span>
                  {item.meta && (
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-50 text-[10px] text-slate-500"
                    >
                      {item.meta}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.detail}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ReviewPage() {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const queue = await getReviewQueue(churchId);
  const totalOpen =
    queue.counts.pendingRegistrations +
    queue.counts.claimRequests +
    queue.counts.stuckEmails +
    queue.counts.webhookFailures;

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Operations
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Review queue
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Registrations, profile claims, email outbox items, and webhook
            failures that need administrator attention.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          {totalOpen > 0 ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}
          <div>
            <div className="text-lg font-bold text-slate-950">{totalOpen}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Open items
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const value = queue.counts[stat.key];
          return (
            <div
              key={stat.key}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-950">
                  {value}
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  {stat.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {stat.detail}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <QueueSection
          title="Pending registrations"
          description="Paid registrations and manual-review cases waiting for approval or rejection."
          items={queue.pendingRegistrations}
          empty="No registrations are waiting for review."
          actionLabel="Manage events"
          actionHref="/events"
        />

        <QueueSection
          title="Profile claim requests"
          description="Verified accounts that need a manager to approve profile access."
          items={queue.claimRequests}
          empty="No profile claims require review."
          actionLabel="Open team settings"
          actionHref="/settings/team"
        />

        <QueueSection
          title="Email outbox"
          description="Approved registrations whose confirmation email has not been marked sent."
          items={queue.stuckEmails}
          empty="No confirmation emails are stuck."
          actionLabel="Open events"
          actionHref="/events"
        />

        <QueueSection
          title="Webhook failures"
          description="Recent failed webhook deliveries from connected systems."
          items={queue.webhookFailures}
          empty="No webhook failures are waiting."
          actionLabel="Open webhooks"
          actionHref="/settings/webhooks"
        />
      </div>
    </div>
  );
}
