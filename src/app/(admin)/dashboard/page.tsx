// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  GitBranch,
  LayoutList,
  Plus,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow, startOfMonth, startOfWeek } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/tenant-context';

const statStyles = [
  {
    icon: Users,
    label: 'Active people',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: UserRoundCheck,
    label: 'Visitors',
    color: 'bg-sky-100 text-sky-700',
  },
  {
    icon: Plus,
    label: 'New this month',
    color: 'bg-violet-100 text-violet-700',
  },
  {
    icon: Activity,
    label: 'Activity this week',
    color: 'bg-amber-100 text-amber-700',
  },
];

export default async function DashboardPage() {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const supabase = await createClient();

  const [activeRes, visitorRes, newRes, eventsRes] = await Promise.all([
    supabase
      .from('people')
      .select('id', { count: 'exact' })
      .eq('church_id', churchId)
      .eq('status', 'active'),
    supabase
      .from('people')
      .select('id', { count: 'exact' })
      .eq('church_id', churchId)
      .eq('status', 'visitor'),
    supabase
      .from('people')
      .select('id', { count: 'exact' })
      .eq('church_id', churchId)
      .gte('created_at', startOfMonth(new Date()).toISOString()),
    supabase
      .from('person_events')
      .select('id', { count: 'exact' })
      .eq('church_id', churchId)
      .gte('occurred_at', startOfWeek(new Date()).toISOString()),
  ]);

  const { data: recentActivity } = await supabase
    .from('person_events')
    .select('*, people(id, first_name, last_name)')
    .eq('church_id', churchId)
    .order('occurred_at', { ascending: false })
    .limit(8);

  const { data: newVisitors } = await supabase
    .from('people')
    .select(`
      id,
      first_name,
      last_name,
      email,
      created_at,
      status,
      person_events(source),
      workflow_cards!left(
        id,
        workflow_steps(name)
      )
    `)
    .eq('church_id', churchId)
    .eq('status', 'visitor')
    .gte('created_at', startOfMonth(new Date()).toISOString())
    .order('created_at', { ascending: false })
    .limit(8);

  const statValues = [
    activeRes.count || 0,
    visitorRes.count || 0,
    newRes.count || 0,
    eventsRes.count || 0,
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 sm:p-8 lg:p-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            {format(new Date(), 'EEEE, d MMMM')}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Ministry overview
          </h1>
          <p className="mt-2 text-slate-500">
            The people, follow-ups, and activity that need your attention.
          </p>
        </div>
        {canManage && (
          <Link
            href="/people/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Add person
          </Link>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statStyles.map((stat, index) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_-30px_rgba(15,23,42,0.5)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                  {statValues[index].toLocaleString()}
                </p>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${stat.color}`}>
                <stat.icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
              Current snapshot
            </p>
          </div>
        ))}
      </section>

      {canManage && <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: LayoutList,
            href: '/lists/new',
            label: 'Build a smart list',
            detail: 'Create a live ministry audience',
          },
          {
            icon: GitBranch,
            href: '/workflows',
            label: 'Review follow-up',
            detail: 'Move people to their next step',
          },
          {
            icon: CalendarDays,
            href: '/events/new',
            label: 'Create an event',
            detail: 'Open a registration page',
          },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition-all hover:border-emerald-200 hover:shadow-sm"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-700">
              <action.icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900">{action.label}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">
                {action.detail}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
          </Link>
        ))}
      </section>}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-bold text-slate-950">New visitors</h2>
              <p className="mt-1 text-xs text-slate-500">
                Added during {format(new Date(), 'MMMM')}
              </p>
            </div>
            <Link
              href="/people?status=visitor"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              View all
            </Link>
          </div>

          {!newVisitors?.length ? (
            <div className="px-6 py-16 text-center">
              <UserRoundCheck className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No new visitors this month
              </p>
              <p className="mt-1 text-xs text-slate-400">
                New records will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {newVisitors.map((visitor) => {
                const source = visitor.person_events?.[0]?.source;
                const workflow =
                  visitor.workflow_cards?.[0]?.workflow_steps?.[0]?.name;
                const initials =
                  `${visitor.first_name.charAt(0)}${visitor.last_name.charAt(0)}`.toUpperCase();

                return (
                  <div
                    key={visitor.id}
                    className="grid items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:grid-cols-[1fr_0.6fr_0.8fr] sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/people/${visitor.id}`}
                          className="block truncate text-sm font-bold text-slate-900 hover:text-emerald-700"
                        >
                          {visitor.first_name} {visitor.last_name}
                        </Link>
                        <div className="truncate text-xs text-slate-500">
                          {visitor.email || 'No email address'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600">
                        {source?.replace('_', ' ') || 'Manual'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-medium text-slate-600">
                        {workflow || 'Not in workflow'}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatDistanceToNow(new Date(visitor.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="font-bold text-slate-950">Recent activity</h2>
            <p className="mt-1 text-xs text-slate-500">
              Updates from People and connected systems
            </p>
          </div>
          <div className="px-5 py-2 sm:px-6">
            {!recentActivity?.length ? (
              <p className="py-14 text-center text-sm text-slate-400">
                No recent activity.
              </p>
            ) : (
              recentActivity.map((activity, index) => (
                <div
                  key={activity.id}
                  className="relative flex gap-3 py-4 before:absolute before:bottom-0 before:left-[15px] before:top-10 before:w-px before:bg-slate-100 last:before:hidden"
                >
                  <div className="relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 ring-4 ring-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-5 text-slate-600">
                      <Link
                        href={`/people/${activity.person_id}`}
                        className="font-bold text-slate-900 hover:text-emerald-700"
                      >
                        {activity.people?.first_name} {activity.people?.last_name}
                      </Link>{' '}
                      {activity.event_type?.replaceAll('_', ' ') ||
                        'completed an action'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="capitalize">
                        {activity.source?.replace('_', ' ')}
                      </span>
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(activity.occurred_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
