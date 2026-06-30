import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const churchSlug = user.user_metadata?.church_slug || 'harvestgen'
  const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single()
  if (!church) return NextResponse.json({ error: 'No church' }, { status: 400 })

  const { id } = await params;

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('webhook_id', id)
    .eq('church_id', church.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
