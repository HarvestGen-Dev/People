// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'
import { recordAuditLog } from '@/lib/audit-log'
import { validateWebhookDestination } from '@/lib/webhooks'
import { z } from 'zod'
import { readJsonObject, validationErrorResponse } from '@/lib/validation'

const WEBHOOK_EVENTS = new Set([
  'person.created',
  'person.updated',
  'person.status_changed',
  'event.logged',
])

const webhookCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2048),
  events: z.array(z.enum([
    'person.created',
    'person.updated',
    'person.status_changed',
    'event.logged',
  ])).min(1).max(20),
}).strict()

export async function GET() {
  try {
    const { churchId } = await requireTenantContext({ requireDeveloperTools: true })
    const supabase = await createClient()

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, name, url, events, is_active, created_at, deliveries:webhook_deliveries!webhook_deliveries_church_webhook_fk(id, delivered_at, failed_at, response_status, created_at)')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(webhooks)
  } catch (error: unknown) {
    return adminApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const { churchId, user } = await requireTenantContext({ requireDeveloperTools: true })
    const supabase = await createClient()
    const body = await readJsonObject(req)
    if (body instanceof NextResponse) return body
    const parsed = webhookCreateSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)
    const { name, url } = parsed.data
    const events = [...new Set(parsed.data.events)].filter((event) => WEBHOOK_EVENTS.has(event))

    let endpoint: URL
    try {
      endpoint = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Endpoint URL is invalid' }, { status: 400 })
    }
    if (!['http:', 'https:'].includes(endpoint.protocol)) {
      return NextResponse.json(
        { error: 'Endpoint URL must use HTTP or HTTPS' },
        { status: 400 }
      )
    }
    const destination = await validateWebhookDestination(url)
    if (!destination.ok) {
      return NextResponse.json(
        { error: 'Endpoint URL cannot target localhost, private networks, link-local addresses, or metadata services' },
        { status: 400 }
      )
    }

    const secret = crypto.randomUUID()

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        church_id: churchId,
        name,
        url,
        events,
        secret,
        is_active: true,
      })
      .select('id, name, url, events, is_active, created_at')
      .single()

    if (error) throw error
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook.created',
      resourceType: 'webhook',
      resourceDisplayId: data.name,
      metadata: {
        events: data.events,
        url_host: endpoint.host,
      },
      request: req,
    })

    return NextResponse.json(data)
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
// <!-- AGENT: BACKEND -->
