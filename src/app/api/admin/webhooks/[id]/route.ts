// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'
import { recordAuditLog } from '@/lib/audit-log'

function safeUrlHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({ requireDeveloperTools: true })
    const supabase = await createClient()
    const { id } = await params;
    const body = await req.json()
    const { is_active } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'is_active must be a boolean' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('webhooks')
      .update({ is_active })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('id, name, url, events, is_active, created_at')
      .single()

    if (error) throw error
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook.updated',
      resourceType: 'webhook',
      resourceDisplayId: data.name,
      metadata: {
        is_active: data.is_active,
      },
      request: req,
    })

    return NextResponse.json(data)
  } catch (error: unknown) {
    return adminApiError(error)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({ requireDeveloperTools: true })
    const supabase = await createClient()
    const { id } = await params;

    const { data: webhook } = await supabase
      .from('webhooks')
      .select('name, url')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle()

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId)

    if (error) throw error
    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook.deleted',
      resourceType: 'webhook',
      resourceDisplayId: webhook?.name || null,
      metadata: webhook
        ? {
            url_host: safeUrlHost(webhook.url),
          }
        : null,
      request: req,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
// <!-- AGENT: BACKEND -->
