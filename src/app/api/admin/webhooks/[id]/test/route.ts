import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'
import { recordAuditLog } from '@/lib/audit-log'
import { processWebhookDelivery, type ClaimedWebhookDelivery } from '@/lib/webhooks'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({ requireDeveloperTools: true })
    const supabase = await createClient()
    const { id } = await params;

  // Ensure webhook exists and belongs to church
  const { data: webhook, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', id)
    .eq('church_id', churchId)
    .single()

  if (error || !webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  
  const payload = {
    message: 'This is a test delivery from People (HarvestGen)'
  }
  
  const fullPayload = {
    event: 'webhook.test',
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    data: payload,
  }
  
  const deliveryId = crypto.randomUUID()

  const deliveryRecord = await supabase
    .from('webhook_deliveries')
    .insert({
      church_id: churchId,
      webhook_id: webhook.id,
      event_id: fullPayload.event_id,
      delivery_id: deliveryId,
      event_type: 'webhook.test',
      payload: fullPayload,
      status: 'processing',
      attempt_count: 1,
      last_attempted_at: new Date().toISOString(),
      processing_lease_until: new Date(Date.now() + 60_000).toISOString(),
    })
    .select('id')
    .single()

  const startTime = Date.now()
  if (deliveryRecord.error || !deliveryRecord.data) throw deliveryRecord.error

  const result = await processWebhookDelivery({
    id: deliveryRecord.data.id,
    church_id: churchId,
    webhook_id: webhook.id,
    webhook_url: webhook.url,
    webhook_secret: webhook.secret,
    event_type: 'webhook.test',
    event_id: fullPayload.event_id,
    delivery_id: deliveryId,
    payload: fullPayload,
    attempt_count: 1,
  } as ClaimedWebhookDelivery)
  
  const duration = Date.now() - startTime
  const success = result === 'delivered'
  const { data: finalDelivery } = await supabase
    .from('webhook_deliveries')
    .select('last_status_code, last_error')
    .eq('id', deliveryRecord.data.id)
    .single()

  if (!success) {
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook.tested',
      resourceType: 'webhook',
      resourceDisplayId: webhook.name,
      metadata: {
        success: false,
        duration_ms: duration,
        response_status: finalDelivery?.last_status_code ?? null,
      },
      request: req,
    })

    return NextResponse.json({ success: false, error: finalDelivery?.last_error || result, duration }, { status: 500 })
  }

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook.tested',
      resourceType: 'webhook',
      resourceDisplayId: webhook.name,
      metadata: {
        success: true,
        duration_ms: duration,
        response_status: finalDelivery?.last_status_code ?? null,
      },
      request: req,
    })

    return NextResponse.json({ success: true, duration })
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
