import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const churchSlug = user.user_metadata?.church_slug || 'harvestgen'
  const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single()
  if (!church) return NextResponse.json({ error: 'No church' }, { status: 400 })

  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('*, deliveries:webhook_deliveries(id, delivered_at, failed_at, response_status)')
    .eq('church_id', church.id)
    .order('created_at', { ascending: false })
    // In Supabase we can do nested ordering/limits but it's easier to just fetch all deliveries or sort client side.
    // Actually, Supabase supports fetching related records. Let's just fetch them and the client can look at the latest.

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(webhooks)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const churchSlug = user.user_metadata?.church_slug || 'harvestgen'
  const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single()
  if (!church) return NextResponse.json({ error: 'No church' }, { status: 400 })

  const body = await req.json()
  const { name, url, events } = body

  if (!name || !url || !events || !events.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const secret = crypto.randomUUID()

  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      church_id: church.id,
      name,
      url,
      events,
      secret,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
