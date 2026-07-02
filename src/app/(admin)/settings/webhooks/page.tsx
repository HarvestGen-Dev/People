// <!-- AGENT: FRONTEND -->
import { Topbar } from '@/components/layout/Topbar'
import { createServiceClient } from '@/lib/supabase/server'
import { WebhooksClient } from './WebhooksClient'
import { requireTenantContext } from '@/lib/tenant-context'

export const metadata = {
  title: 'Webhooks | Settings'
}

export default async function WebhooksSettingsPage() {
  const { churchId } = await requireTenantContext({ requireManager: true })
  const supabase = createServiceClient()

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('id, name, url, events, is_active, created_at, deliveries:webhook_deliveries(id, delivered_at, failed_at, response_status, created_at)')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })

  return (
    <>
      <Topbar title="Webhooks" />
      <div className="mx-auto max-w-6xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <WebhooksClient initialWebhooks={webhooks || []} />
      </div>
    </>
  )
}
