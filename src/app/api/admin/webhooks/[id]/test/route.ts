import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true })
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
    timestamp: new Date().toISOString(),
    data: payload,
  }
  
  const body = JSON.stringify(fullPayload)
  const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')

  const deliveryRecord = await supabase
    .from('webhook_deliveries')
    .insert({
      church_id: churchId,
      webhook_id: webhook.id,
      event_type: 'webhook.test',
      payload: fullPayload,
    })
    .select('id')
    .single()

  const startTime = Date.now()
  let responseStatus = null
  let errorMessage = null

  try {
    const fetchResponse = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-People-Signature': `sha256=${signature}`,
        'X-People-Event': 'webhook.test',
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
        response_status: responseStatus,
        error_message: errorMessage,
        delivered_at: !errorMessage ? new Date().toISOString() : null,
        failed_at: errorMessage ? new Date().toISOString() : null,
      })
      .eq('id', deliveryRecord.data.id)
  }

  if (errorMessage) {
    return NextResponse.json({ success: false, error: errorMessage, duration }, { status: 500 })
  }

    return NextResponse.json({ success: true, duration })
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
