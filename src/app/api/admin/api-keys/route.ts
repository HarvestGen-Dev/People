import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single();
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 });

    const body = await request.json();

    // Generate API key
    const random = crypto.randomBytes(16).toString('hex');
    const rawKey = `people_k1_${random}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.substring(0, 18);

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        church_id: church.id,
        name: body.name,
        description: body.description || null,
        key_hash: keyHash,
        key_prefix: prefix,
        scopes: body.scopes || [],
        expires_at: body.expires_at || null,
        is_active: true,
      })
      .select('id, name, key_prefix, scopes, is_active, expires_at, last_used_at, created_at')
      .single();

    if (error) throw error;
    
    // Return the raw key ONCE
    return NextResponse.json({ data: { apiKey: data, rawKey } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
