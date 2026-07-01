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

    const { data, error } = await supabase
      .from('webhooks')
      .update({ is_active })
      .eq('id', id)
      .eq('church_id', churchId)
      .select()
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
