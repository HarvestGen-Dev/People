// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'
import { recordAuditLog } from '@/lib/audit-log'

const WEBHOOK_EVENTS = new Set([
  'person.created',
  'person.updated',
  'person.status_changed',
  'event.logged',
])

export async function GET() {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true })
    const supabase = await createClient()

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, name, url, events, is_active, created_at, deliveries:webhook_deliveries(id, delivered_at, failed_at, response_status, created_at)')
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
    const { churchId, user } = await requireTenantContext({ requireManager: true })
    const supabase = await createClient()
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const events = Array.isArray(body.events)
      ? [...new Set(body.events.filter((event: unknown): event is string => (
          typeof event === 'string' && WEBHOOK_EVENTS.has(event)
        )))]
      : []

    if (!name || !url || !events.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (
      Array.isArray(body.events) &&
      events.length !== new Set(body.events).size
    ) {
      return NextResponse.json(
        { error: 'One or more webhook events are invalid' },
        { status: 400 }
      )
    }

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
