import crypto from 'crypto'
import net from 'net'
import { createServiceClient } from '@/lib/supabase/server'

export type WebhookEvent =
  | 'person.created'
  | 'person.updated'
  | 'person.status_changed'
  | 'event.logged'
  | 'webhook.test'

const WEBHOOK_TIMEOUT_MS = 10000
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 8 * 60 * 60_000, 24 * 60 * 60_000]

export function isUnsafeWebhookUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return true
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return true
  const hostname = url.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === 'metadata.google.internal'
  ) {
    return true
  }

  const ipVersion = net.isIP(hostname)
  if (ipVersion === 4) {
    const [first, second] = hostname.split('.').map(Number)
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    )
  }

  if (ipVersion === 6) {
    return (
      hostname === '::1' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe80:')
    )
  }

  return false
}

export function signWebhook(secret: string, timestamp: string, body: string) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')
}

function nextRetryAt(attemptCount: number): string | null {
  const delay = RETRY_DELAYS_MS[attemptCount - 1]
  if (!delay) return null
  return new Date(Date.now() + delay).toISOString()
}

function isRetryableStatus(status: number | null): boolean {
  return status === 429 || (status !== null && status >= 500)
}

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
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    data: payload,
  }

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
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
          event_type: eventType,
          payload: fullPayload,
          status: 'processing',
          attempt_count: 1,
        })
        .select('id, attempt_count')
        .single()

      if (deliveryRecord.error || !deliveryRecord.data) {
        console.error('Failed to insert webhook delivery record:', deliveryRecord.error)
        return
      }

      try {
        if (isUnsafeWebhookUrl(webhook.url)) {
          throw new Error('unsafe_webhook_destination')
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            'Content-Type': 'application/json',
            'X-People-Signature': `sha256=${signature}`,
            'X-People-Event': eventType,
            'X-People-Event-Id': fullPayload.event_id,
            'X-People-Delivery-Id': deliveryId,
            'X-People-Timestamp': timestamp,
          },
          body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        })

        const retryable = isRetryableStatus(response.status)
        const nextAttemptAt = retryable ? nextRetryAt(1) : null
        await supabase
          .from('webhook_deliveries')
          .update({
            response_status: response.status,
            last_status_code: response.status,
            last_error: response.ok ? null : await response.text().catch(() => 'Webhook returned an unsuccessful response'),
            status: response.ok ? 'delivered' : retryable && nextAttemptAt ? 'retry_scheduled' : 'permanently_failed',
            delivered_at: response.ok ? new Date().toISOString() : null,
            failed_at: response.ok ? null : new Date().toISOString(),
            next_attempt_at: response.ok ? null : nextAttemptAt,
          })
          .eq('id', deliveryRecord.data.id)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        const retryable = errorMessage !== 'unsafe_webhook_destination'
        const nextAttemptAt = retryable ? nextRetryAt(1) : null
        await supabase
          .from('webhook_deliveries')
          .update({
            status: retryable && nextAttemptAt ? 'retry_scheduled' : 'permanently_failed',
            error_message: errorMessage,
            last_error: errorMessage,
            failed_at: new Date().toISOString(),
            next_attempt_at: nextAttemptAt,
          })
          .eq('id', deliveryRecord.data.id)
      }
    })
  )
}
