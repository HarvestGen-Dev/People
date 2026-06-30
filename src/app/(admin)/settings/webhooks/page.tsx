import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WebhooksClient } from './WebhooksClient'

export const metadata = {
  title: 'Webhooks Settings | HarvestGen People'
}

export default async function WebhooksSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const churchSlug = user.user_metadata?.church_slug || 'harvestgen'
  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single()

  if (!church) redirect('/login')

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*, deliveries:webhook_deliveries(id, delivered_at, failed_at, response_status)')
    .eq('church_id', church.id)
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
