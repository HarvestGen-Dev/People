// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { EmptyState, PageHeader, PanelHeader, WorkspacePage } from '@/components/workspace/Workspace';
import { PersonAvatar, PersonStatus } from '@/components/people/PersonIdentity';
import { FollowUpRows, type FollowUp } from '@/components/workflows/FollowUpRows';
import { formatDistanceToNow, startOfMonth } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/tenant-context';
import { displayIdFor } from '@/lib/display-ids';
import { createRequestPerformanceTracker } from '@/lib/performance';

type DashboardSummary = {
  active_count: number;
  visitor_count: number;
  new_this_month_count: number;
  activity_this_week_count: number;
};

type RecentActivityRow = {
  id: string;
  person_id: string;
  source: string | null;
  event_type: string | null;
  occurred_at: string;
  people: {
    id: string;
    display_id: string;
    first_name: string;
    last_name: string;
  } | null;
};

export default async function DashboardPage() {
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();
  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';
  const canComplete = canManage || role === 'workflow_manager';
  const canOpenPeople = role !== 'workflow_manager';
  const supabase = createServiceClient();
  const perf = createRequestPerformanceTracker('dashboard');

  const [
    summaryRes,
    recentActivityRes,
    newVisitorsRes,
    overdueCardsRes,
    pendingRegistrationsRes,
  ] = await Promise.all([
    perf.track(
      'dashboard.summary',
      supabase.rpc('get_dashboard_summary', { p_church_id: churchId }).single()
    ),
    perf.track('dashboard.recent_activity', supabase
      .from('person_events')
      .select(`
        id,
        person_id,
        source,
        event_type,
        occurred_at,
        people!person_events_church_person_fk(id, display_id, first_name, last_name)
      `)
      .eq('church_id', churchId)
      .order('occurred_at', { ascending: false })
      .limit(8)),
    perf.track('dashboard.new_visitors', supabase
      .from('people')
      .select(`
        id,
        display_id,
        first_name,
        last_name,
        email,
        created_at,
        status,
        person_events!person_events_church_person_fk(source),
        workflow_cards!workflow_cards_church_person_fk(
          id,
          workflow_steps!workflow_cards_church_current_step_fk(name)
        )
      `)
      .eq('church_id', churchId)
      .eq('status', 'visitor')
      .gte('created_at', startOfMonth(new Date()).toISOString())
      .order('created_at', { ascending: false })
      .limit(8)),
    perf.track('dashboard.overdue_cards', supabase
      .from('workflow_cards')
      .select(`
        id,
        due_date,
        person_id,
        people!workflow_cards_church_person_fk!inner(first_name, last_name, id, display_id),
        workflow_steps!workflow_cards_church_current_step_fk(name),
        workflows!workflow_cards_church_workflow_fk!inner(id, display_id, name, church_id)
      `)
      .eq('church_id', churchId)
      .eq('workflows.church_id', churchId)
      .is('completed_at', null)
      .not('due_date', 'is', null)
      .lt('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(5)),
    canManage
      ? perf.track('dashboard.pending_registrations', supabase
          .from('event_registrations')
          .select(`
            id,
            display_id,
            first_name,
            last_name,
            email,
            guests,
            amount_due,
            created_at,
            events!event_registrations_church_event_fk!inner(id, display_id, name, start_at, church_id, currency)
          `, { count: 'exact' })
          .eq('church_id', churchId)
          .eq('events.church_id', churchId)
          .eq('status', 'pending_review')
          .order('created_at', { ascending: true })
          .limit(5))
      : Promise.resolve({ data: [], count: 0, error: null }),
  ]);

  const recentActivity = recentActivityRes.data as unknown as RecentActivityRow[] | null;
  const newVisitors = newVisitorsRes.data;
  const overdueCards = overdueCardsRes.data as unknown as FollowUp[] | null;
  const pendingRegistrations = pendingRegistrationsRes.data as unknown as {
    id: string;
    display_id: string;
    first_name: string;
    last_name: string;
    email: string;
    guests: number;
    amount_due: number;
    created_at: string;
    events: {
      id: string;
      display_id: string;
      name: string;
      start_at: string;
      church_id: string;
      currency: string;
    };
  }[] | null;
  const pendingRegistrationCount = pendingRegistrationsRes.count || 0;


  if (summaryRes.error) {
    throw summaryRes.error;
  }

  const summary = summaryRes.data as DashboardSummary | null;
  const metrics = [
    ['Active people', summary?.active_count],
    ['Visitors', summary?.visitor_count],
    ['New this month', summary?.new_this_month_count],
    ['Activity this week', summary?.activity_this_week_count],
  ] as const;
  const today = new Intl.DateTimeFormat('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date());

  perf.log();

  return (
    <WorkspacePage>
      <PageHeader eyebrow={today} title="Ministry overview"
        description="See who’s new and what needs your attention."
        actions={canManage && <Link href="/people/new" className="workspace-button" data-primary><Plus size={16} aria-hidden="true" /> Add person</Link>}
      />

      <dl className="workspace-panel workspace-metrics" aria-label="Key metrics">
        {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? '—' : Number(value).toLocaleString('en-MY')}</dd></div>)}
      </dl>

      <div className="workspace-overview-grid">
        <div className="space-y-5">
          <section className="workspace-panel" id="overview-follow-ups" tabIndex={-1} aria-label="Overdue follow-ups">
            <PanelHeader title="Overdue follow-ups" description="People waiting on a next step."
              action={<Link className="workspace-link" href="/workflows">View follow-ups <ArrowRight size={16} aria-hidden="true" /></Link>} />
            {overdueCardsRes.error ? <EmptyState title="Could not load follow-ups" description="Open Follow-ups to try again." />
              : overdueCards?.length ? <FollowUpRows cards={overdueCards} canComplete={canComplete} focusTarget="overview-follow-ups" overdueOnly />
              : <EmptyState title="No overdue follow-ups" description="When a follow-up passes its due date, it will appear here." />}
          </section>
          {canManage && <section className="workspace-panel" aria-label="Registration review">
            <PanelHeader title="Registration review"
              description={pendingRegistrationCount ? `${pendingRegistrationCount.toLocaleString('en-MY')} awaiting review` : 'Payment and attendance approvals'}
              action={<Link className="workspace-link" href="/events">View events</Link>} />
            {pendingRegistrationsRes.error ? <EmptyState title="Could not load registrations" description="Open Events to try again." />
              : pendingRegistrations?.length ? (
                <ul className="workspace-rows">
                  {pendingRegistrations.map((registration) => (
                    <li key={registration.id} className="workspace-row">
                      <div className="workspace-row-content">
                        <Link className="workspace-row-link" href={`/events/${displayIdFor(registration.events)}/registrations?status=pending_review`}>
                          {registration.first_name} {registration.last_name}
                        </Link>
                        <p><span>{registration.events.name}</span> · {registration.guests + 1} attending</p>
                        <p>{registration.email}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{Number(registration.amount_due).toLocaleString('en-MY', { style: 'currency', currency: registration.events.currency || 'MYR' })}</p>
                        <p className="mt-1">{formatDistanceToNow(new Date(registration.created_at), { addSuffix: true })}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No pending registrations" description="New signups that need approval will appear here." />}
          </section>}
        </div>

        <div className="space-y-5">
          <section className="workspace-panel" aria-label="Recent visitors">
            <PanelHeader title="Recently added visitors" description="New connections this month."
              action={canOpenPeople && <Link className="workspace-link" href="/people?status=visitor">Directory</Link>} />
            {newVisitorsRes.error ? <EmptyState title="Could not load visitors" description="Open the directory to try again." />
              : newVisitors?.length ? (
                <ul className="workspace-rows">
                  {newVisitors.map((visitor) => {
                    const name = `${visitor.first_name} ${visitor.last_name}`;
                    const source = visitor.person_events?.[0]?.source?.replaceAll('_', ' ') || 'Manual';
                    const step = visitor.workflow_cards?.[0]?.workflow_steps?.[0]?.name;
                    return (
                      <li key={visitor.id} className="workspace-row">
                        <PersonAvatar person={visitor} />
                        <div className="workspace-row-content">
                          {canOpenPeople ? <Link className="workspace-row-link" href={`/people/${displayIdFor(visitor)}`}>{name}</Link> : <strong>{name}</strong>}
                          <p>{visitor.email || 'No email address'}</p>
                          <p className="first-letter:uppercase">{source}{step ? ` · ${step}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <PersonStatus status="visitor" />
                          <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(visitor.created_at), { addSuffix: true })}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState title="No new visitors this month" description="New visitors will appear here as they’re added." />}
          </section>
          <section className="workspace-panel" aria-label="Recent activity">
            <PanelHeader title="Recent activity" description="Updates from People and connected systems." />
            {recentActivityRes.error ? <EmptyState title="Could not load activity" description="Refresh the page to try again." />
              : recentActivity?.length ? (
                <ul className="workspace-rows">
                  {recentActivity.map(({ id, people, event_type, source, occurred_at }) => (
                    <li key={id} className="workspace-row">
                      <div className="workspace-row-content">
                        {people && canOpenPeople ? <Link className="workspace-row-link" href={`/people/${displayIdFor(people)}`}>{people.first_name} {people.last_name}</Link>
                          : people ? <strong>{people.first_name} {people.last_name}</strong> : <strong>Person unavailable</strong>}
                        <p className="first-letter:uppercase">{event_type?.replaceAll('_', ' ') || 'Activity recorded'}{source ? ` · ${source.replaceAll('_', ' ')}` : ''}</p>
                      </div>
                      <p className="text-right text-xs text-muted-foreground">{formatDistanceToNow(new Date(occurred_at), { addSuffix: true })}</p>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No recent activity" description="Updates will appear here as people take part." />}
          </section>
        </div>
      </div>
    </WorkspacePage>
  );
}
