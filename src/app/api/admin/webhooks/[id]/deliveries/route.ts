import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireDeveloperTools: true })
    const supabase = await createClient()
    const { id } = await params;

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', id)
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: unknown) {
    return adminApiError(error)
  }
}
