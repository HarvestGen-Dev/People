// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true })
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
    return NextResponse.json(data)
  } catch (error: unknown) {
    return adminApiError(error)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true })
    const supabase = await createClient()
    const { id } = await params;

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
// <!-- AGENT: BACKEND -->
