import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export type WebhookEvent =
  | 'person.created'
  | 'person.updated'
  | 'person.status_changed'
  | 'event.logged'
  | 'webhook.test'

export async function dispatchWebhook(
  churchId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .contains('events', [eventType])

  if (!webhooks?.length) return

  const fullPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  }

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const body = JSON.stringify(fullPayload)
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex')

      const deliveryRecord = await supabase
        .from('webhook_deliveries')
        .insert({
          church_id: churchId,
          webhook_id: webhook.id,
          event_type: eventType,
          payload: fullPayload,
        })
        .select('id')
        .single()

      if (deliveryRecord.error || !deliveryRecord.data) {
        console.error('Failed to insert webhook delivery record:', deliveryRecord.error)
        return
      }

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-People-Signature': `sha256=${signature}`,
            'X-People-Event': eventType,
          },
          body,
          signal: AbortSignal.timeout(10000),  // 10s timeout
        })

        await supabase
          .from('webhook_deliveries')
          .update({
            response_status: response.status,
            delivered_at: new Date().toISOString(),
          })
          .eq('id', deliveryRecord.data.id)

      } catch (err) {
        await supabase
          .from('webhook_deliveries')
          .update({
            error_message: err instanceof Error ? err.message : 'Unknown error',
            failed_at: new Date().toISOString(),
          })
          .eq('id', deliveryRecord.data.id)
      }
    })
  )
}
