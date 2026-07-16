import crypto from 'crypto'
import net from 'net'
import dns from 'dns/promises'
import { createServiceClient } from '@/lib/supabase/server'

export type WebhookEvent =
  | 'person.created'
  | 'person.updated'
  | 'person.status_changed'
  | 'event.logged'
  | 'webhook.test'

const WEBHOOK_TIMEOUT_MS = 10000
const MAX_WEBHOOK_ATTEMPTS = 7
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 8 * 60 * 60_000, 24 * 60 * 60_000]

export type ClaimedWebhookDelivery = {
  id: string
  church_id: string
  webhook_id: string
  webhook_url: string
  webhook_secret: string
  event_type: WebhookEvent
  event_id: string
  delivery_id: string
  payload: Record<string, unknown>
  attempt_count: number
}

export function isUnsafeWebhookUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return true
  }

  if (url.username || url.password) return true
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return true
  const hostname = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
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
      first >= 224 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    )
  }

  if (ipVersion === 6) {
    return (
      hostname === '::1' ||
      hostname === '::' ||
      hostname.startsWith('::ffff:127.') ||
      hostname.startsWith('::ffff:10.') ||
      hostname.startsWith('::ffff:192.168.') ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe80:') ||
      hostname.startsWith('ff')
    )
  }

  return false
}

export async function validateWebhookDestination(
  value: string,
  options: { allowLocal?: boolean } = {}
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'embedded_credentials_not_allowed' }
  }

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !options.allowLocal) {
    return { ok: false, reason: 'https_required' }
  }

  if (isUnsafeWebhookUrl(value) && !options.allowLocal) {
    return { ok: false, reason: 'unsafe_webhook_destination' }
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')

  if (options.allowLocal && (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1')) {
    return { ok: true, url }
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true })
    if (!addresses.length) {
      return { ok: false, reason: 'dns_no_addresses' }
    }
    for (const address of addresses) {
      if (isUnsafeWebhookUrl(`${url.protocol}//${address.address}`)) {
        return { ok: false, reason: 'unsafe_resolved_address' }
      }
    }
  } catch {
    return { ok: false, reason: 'dns_lookup_failed' }
  }

  return { ok: true, url }
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
  return status === 408 || status === 425 || status === 429 || (status !== null && status >= 500)
}

function sanitizeExcerpt(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 1000)
}

function failureState(attemptCount: number, retryable: boolean) {
  const nextAttemptAt = retryable && attemptCount < MAX_WEBHOOK_ATTEMPTS
    ? nextRetryAt(attemptCount)
    : null
  return {
    status: nextAttemptAt ? 'retry_scheduled' : 'permanently_failed',
    nextAttemptAt,
  }
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

  const eventId = crypto.randomUUID()
  const fullPayload = {
    event: eventType,
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data: payload,
  }

  await Promise.all(
    webhooks.map(async (webhook) => {
      await supabase
        .from('webhook_deliveries')
        .insert({
          church_id: churchId,
          webhook_id: webhook.id,
          event_id: eventId,
          delivery_id: crypto.randomUUID(),
          event_type: eventType,
          payload: fullPayload,
          status: 'pending',
          attempt_count: 0,
        })
    })
  )
}

export async function processWebhookDelivery(
  delivery: ClaimedWebhookDelivery
): Promise<'delivered' | 'retry_scheduled' | 'permanently_failed'> {
  const supabase = createServiceClient()
  const body = JSON.stringify(delivery.payload)
  const timestamp = new Date().toISOString()
  const validation = await validateWebhookDestination(delivery.webhook_url, {
    allowLocal: process.env.ALLOW_LOCAL_WEBHOOKS === 'true',
  })

  if (!validation.ok) {
    const retryable = validation.reason === 'dns_lookup_failed'
    const failed = failureState(delivery.attempt_count, retryable)
    await supabase
      .from('webhook_deliveries')
      .update({
        status: failed.status,
        error_message: validation.reason,
        last_error: validation.reason,
        failed_at: new Date().toISOString(),
        next_attempt_at: failed.nextAttemptAt,
        processing_lease_until: null,
      })
      .eq('id', delivery.id)
    return failed.status as 'retry_scheduled' | 'permanently_failed'
  }

  const signature = signWebhook(delivery.webhook_secret, timestamp, body)

  try {
    const response = await fetch(validation.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'X-People-Signature': `sha256=${signature}`,
        'X-People-Event': delivery.event_type,
        'X-People-Event-Id': delivery.event_id,
        'X-People-Delivery-Id': delivery.delivery_id,
        'X-People-Timestamp': timestamp,
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })

    if (response.ok) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'delivered',
          response_status: response.status,
          last_status_code: response.status,
          error_message: null,
          last_error: null,
          response_excerpt: null,
          delivered_at: new Date().toISOString(),
          failed_at: null,
          next_attempt_at: null,
          processing_lease_until: null,
        })
        .eq('id', delivery.id)
      return 'delivered'
    }

    const retryable = isRetryableStatus(response.status)
    const failed = failureState(delivery.attempt_count, retryable)
    const excerpt = sanitizeExcerpt(await response.text().catch(() => ''))
    await supabase
      .from('webhook_deliveries')
      .update({
        status: failed.status,
        response_status: response.status,
        last_status_code: response.status,
        error_message: `HTTP ${response.status}`,
        last_error: `HTTP ${response.status}`,
        response_excerpt: excerpt || null,
        failed_at: new Date().toISOString(),
        next_attempt_at: failed.nextAttemptAt,
        processing_lease_until: null,
      })
      .eq('id', delivery.id)
    return failed.status as 'retry_scheduled' | 'permanently_failed'
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const failed = failureState(delivery.attempt_count, true)
    await supabase
      .from('webhook_deliveries')
      .update({
        status: failed.status,
        error_message: message,
        last_error: message,
        failed_at: new Date().toISOString(),
        next_attempt_at: failed.nextAttemptAt,
        processing_lease_until: null,
      })
      .eq('id', delivery.id)
    return failed.status as 'retry_scheduled' | 'permanently_failed'
  }
}
