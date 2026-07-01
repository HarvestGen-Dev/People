import { createClient } from '@/lib/supabase/server'
import { WebhooksClient } from './WebhooksClient'
import { requireTenantContext } from '@/lib/tenant-context'

export const metadata = {
  title: 'Webhooks Settings | HarvestGen People'
}

export default async function WebhooksSettingsPage() {
  const { churchId } = await requireTenantContext({ requireManager: true })
  const supabase = await createClient()

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*, deliveries:webhook_deliveries(id, delivered_at, failed_at, response_status)')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Webhooks</h1>
        <p className="text-sm text-slate-500 mt-1">Manage outbound integrations and event notifications.</p>
      </div>

      <WebhooksClient initialWebhooks={webhooks || []} />
    </div>
  )
}
