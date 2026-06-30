import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const ids: string[] = body.ids || [];
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    let approved = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await approveRegistration(id, user.email || null);
      if (result.success) approved++;
      else failed++;
    }

    return NextResponse.json({ data: { approved, failed } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
