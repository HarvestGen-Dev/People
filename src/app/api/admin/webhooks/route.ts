import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'

export async function GET() {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true })
    const supabase = await createClient()

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*, deliveries:webhook_deliveries(id, delivered_at, failed_at, response_status)')
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
    const { churchId } = await requireTenantContext({ requireManager: true })
    const supabase = await createClient()
    const body = await req.json()
    const { name, url, events } = body

    if (!name || !url || !events || !events.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
