import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(request, 'events:read');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const event_type = searchParams.get('event_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const before = searchParams.get('before');

    let query = supabase
      .from('person_events')
      .select('*')
      .eq('church_id', churchId)
      .eq('person_id', id)
      .order('occurred_at', { ascending: false })
      .limit(limit + 1); // +1 to check for has_more

    if (source) query = query.eq('source', source);
    if (event_type) query = query.eq('event_type', event_type);
    if (before) query = query.lt('occurred_at', before);

    const { data: events, error } = await query;
    if (error) throw error;

    const hasMore = events && events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;

    return NextResponse.json({
      data: {
        events: resultEvents || [],
        has_more: hasMore || false,
      }
    });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to load events',
      },
      { status: 500 }
    );
  }
}
