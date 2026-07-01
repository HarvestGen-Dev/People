import { createClient } from '@/lib/supabase/server'
import { startOfMonth, startOfWeek } from 'date-fns'
import { Users, UserPlus, TrendingUp, Activity, User } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { requireTenantContext } from '@/lib/tenant-context'

export default async function DashboardPage() {
  const { churchId } = await requireTenantContext()
  const supabase = await createClient()

  // Fetch stats in parallel
  const [activeRes, visitorRes, newRes, eventsRes] = await Promise.all([
    supabase.from('people').select('id', { count: 'exact' }).eq('church_id', churchId).eq('status', 'active'),
    supabase.from('people').select('id', { count: 'exact' }).eq('church_id', churchId).eq('status', 'visitor'),
    supabase.from('people').select('id', { count: 'exact' }).eq('church_id', churchId).gte('created_at', startOfMonth(new Date()).toISOString()),
    supabase.from('person_events').select('id', { count: 'exact' }).eq('church_id', churchId).gte('occurred_at', startOfWeek(new Date()).toISOString()),
  ])

  // Fetch recent activity
  const { data: recentActivity } = await supabase
    .from('person_events')
    .select('*, people(id, first_name, last_name)')
    .eq('church_id', churchId)
    .order('occurred_at', { ascending: false })
    .limit(20)

  // Fetch new visitors this month
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

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Stat cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 border-b-2 border-b-teal-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Active members</p>
              <h3 className="text-3xl font-bold text-teal-600">{activeRes.count || 0}</h3>
            </div>
            <Users className="text-slate-400 h-5 w-5" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Visitors</p>
              <h3 className="text-3xl font-bold text-slate-800">{visitorRes.count || 0}</h3>
            </div>
            <User className="text-slate-400 h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">New this month</p>
              <h3 className="text-3xl font-bold text-slate-800">{newRes.count || 0}</h3>
            </div>
            <UserPlus className="text-slate-400 h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Events this week</p>
              <h3 className="text-3xl font-bold text-slate-800">{eventsRes.count || 0}</h3>
            </div>
            <Activity className="text-slate-400 h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Quick actions bar */}
      <div className="flex gap-4">
        <Link href="/people/new" className="text-sm font-medium bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          Add person
        </Link>
        <Link href="/lists" className="text-sm font-medium bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          Create list
        </Link>
        <Link href="/workflows" className="text-sm font-medium bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          New workflow card
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New visitors this month (left side, 2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">New visitors this month</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Name + email</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Added</th>
                  <th className="px-6 py-4">Workflow status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {newVisitors?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No new visitors this month.
                    </td>
                  </tr>
                ) : (
                  newVisitors?.map((visitor) => {
                    // Determine source
                    const firstEvent = visitor.person_events?.[0];
                    let sourceText = 'Manual';
                    let sourceColor = 'bg-slate-100 text-slate-700';
                    
                    if (firstEvent?.source === 'drip_brew') {
                      sourceText = 'Drip & Brew';
                      sourceColor = 'bg-amber-100 text-amber-800';
                    } else if (firstEvent?.source === 'shepherd') {
                      sourceText = 'Shepherd';
                      sourceColor = 'bg-blue-100 text-blue-800';
                    }

                    // Determine workflow status
                    const activeCards = visitor.workflow_cards || [];
                    const workflowText = activeCards.length > 0 
                      ? activeCards[0].workflow_steps?.name 
                      : null;

                    return (
                      <tr key={visitor.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <Link href={`/people/${visitor.id}`} className="font-medium text-slate-900 hover:text-teal-600">
                            {visitor.first_name} {visitor.last_name}
                          </Link>
                          <div className="text-slate-500 text-xs mt-0.5">{visitor.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${sourceColor}`}>
                            {sourceText}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(visitor.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {workflowText ? (
                            <span className="text-slate-700 font-medium">{workflowText}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">Not in workflow</span>
                              <Link href="/workflows" className="text-teal-600 hover:text-teal-700 text-xs font-medium">
                                Add
                              </Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity feed (right side, 1/3 width) */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Recent activity</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="space-y-6">
              {recentActivity?.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No recent activity.</p>
              ) : (
                recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="mt-1">
                      {activity.type === 'registration' ? (
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">📚</div>
                      ) : activity.type === 'purchase' ? (
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">☕</div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">👤</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-800">
                        <Link href={`/people/${activity.person_id}`} className="font-medium hover:text-teal-600">
                          {activity.people?.first_name} {activity.people?.last_name}
                        </Link>{' '}
                        {activity.description || 'completed an action'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(activity.occurred_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
