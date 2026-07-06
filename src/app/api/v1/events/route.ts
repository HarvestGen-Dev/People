import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { dispatchWebhook } from '@/lib/webhooks';

const VALID_EVENTS = {
  shepherd: ['course_enrolled', 'course_completed', 'quiz_passed', 'last_active'],
  drip_brew: ['order_placed', 'newcomer_registered', 'promo_used']
};

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request, 'events:write');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;
    const body = await request.json();

    if (!body.person_id) {
      return NextResponse.json({ error: 'person_id is required' }, { status: 400 });
    }

    if (body.source !== 'shepherd' && body.source !== 'drip_brew') {
      return NextResponse.json({ error: 'source must be shepherd or drip_brew' }, { status: 400 });
    }

    const validTypes = VALID_EVENTS[body.source as keyof typeof VALID_EVENTS];
    if (!validTypes.includes(body.event_type)) {
      return NextResponse.json({ 
        error: `Invalid event_type for source ${body.source}. Allowed: ${validTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Verify person exists
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('church_id', churchId)
      .eq('id', body.person_id)
      .single();

    if (!person) {
      return NextResponse.json({ error: 'person_id not found' }, { status: 400 });
    }

    const { data: event, error } = await supabase
      .from('person_events')
      .insert({
        church_id: churchId,
        person_id: body.person_id,
        source: body.source,
        event_type: body.event_type,
        metadata: body.metadata || {},
        occurred_at: body.occurred_at || new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    // Await webhook dispatch to ensure delivery before Vercel terminates the function
    await dispatchWebhook(churchId, 'event.logged', {
      event_id: event.id,
      person_id: body.person_id,
      source: body.source,
      event_type: body.event_type,
      metadata: body.metadata || {}
    });

    return NextResponse.json({ data: { event_id: event.id } }, { status: 201 });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to create event',
      },
      { status: 500 }
    );
  }
}
