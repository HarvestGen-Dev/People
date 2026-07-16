import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'
import { recordAuditLog } from '@/lib/audit-log'
import { isUnsafeWebhookUrl, signWebhook } from '@/lib/webhooks'

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
  
  const body = JSON.stringify(fullPayload)
  const timestamp = new Date().toISOString()
  const signature = signWebhook(webhook.secret, timestamp, body)
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
    })
    .select('id')
    .single()

  const startTime = Date.now()
  let responseStatus = null
  let errorMessage = null

  try {
    if (isUnsafeWebhookUrl(webhook.url)) {
      throw new Error('unsafe_webhook_destination')
    }
    const fetchResponse = await fetch(webhook.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'X-People-Signature': `sha256=${signature}`,
        'X-People-Event': 'webhook.test',
        'X-People-Event-Id': fullPayload.event_id,
        'X-People-Delivery-Id': deliveryId,
        'X-People-Timestamp': timestamp,
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
    responseStatus = fetchResponse.status
    if (!fetchResponse.ok) {
      errorMessage = await fetchResponse.text().catch(() => 'Unknown error')
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
  }
  
  const duration = Date.now() - startTime

  if (deliveryRecord.data) {
    await supabase
      .from('webhook_deliveries')
      .update({
        status: errorMessage ? 'permanently_failed' : 'delivered',
        response_status: responseStatus,
        last_status_code: responseStatus,
        error_message: errorMessage,
        last_error: errorMessage,
        delivered_at: !errorMessage ? new Date().toISOString() : null,
        failed_at: errorMessage ? new Date().toISOString() : null,
      })
      .eq('id', deliveryRecord.data.id)
  }

  if (errorMessage) {
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook.tested',
      resourceType: 'webhook',
      resourceDisplayId: webhook.name,
      metadata: {
        success: false,
        duration_ms: duration,
        response_status: responseStatus,
      },
      request: req,
    })

    return NextResponse.json({ success: false, error: errorMessage, duration }, { status: 500 })
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
        response_status: responseStatus,
      },
      request: req,
    })

    return NextResponse.json({ success: true, duration })
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
